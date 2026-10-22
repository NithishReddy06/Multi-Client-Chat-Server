# Computer Networks concepts

## Client-server architecture

Each browser is a client. The Node.js service is the central server: it authenticates requests, authorizes room membership, validates input, persists messages, and routes events. PostgreSQL is behind the server and is never directly addressed by the browser.

## TCP and the application's protocol

TCP is a reliable, ordered, connection-oriented byte-stream transport between endpoints. A TCP connection is established using SYN, SYN-ACK, ACK, and is closed with FIN/ACK exchanges (or may terminate with RST). TCP does not know the boundaries of a chat message; the application protocol defines those boundaries.

Socket.IO is not a raw TCP socket API. It uses Engine.IO for transport management and adds named events, acknowledgements, reconnection behavior, and optional fallback. For this app, WebSocket and HTTP long-polling are carried over TCP.

## WebSocket versus HTTP long-polling

- **WebSocket:** after an HTTP Upgrade handshake, a persistent full-duplex connection can carry frames in both directions without making a new HTTP request for every event.
- **HTTP long-polling:** the client makes HTTP requests that the server keeps open until an event is available; the client then sends another request. This remains HTTP request/response traffic and incurs more request overhead.
- **Socket.IO:** typically starts with polling and can upgrade to WebSocket when possible. It may remain on polling if the upgrade is unavailable. A capture may therefore show ordinary HTTP polling or a WebSocket upgrade and frames.

The frontend uses the Socket.IO protocol, so it is not interchangeable with a generic WebSocket or a Python `socket` protocol client.

## Bidirectional communication and concurrent connections

After the transport is established, a client can emit `send_message`, and the server can independently emit `receive_message`, presence, and error events. Node.js handles many active sockets using asynchronous I/O; each accepted connection has session and room state. Socket.IO rooms let the server broadcast a message to room peers, excluding the sender with `socket.to(room).emit(...)`.

## Connection lifecycle and reconnection

The browser first obtains an HTTP session. It then connects to Socket.IO with the cookie. Handshake middleware authenticates the session; a join event verifies room membership. On disconnect, server presence is updated. The client can retry transport connection, but each reconnect performs handshake authentication again and rejoins the room. Logout revokes the session and disconnects the matching socket(s); expiry also ends the socket.

## Latency measurement

For a classroom measurement, record `performance.now()` immediately before sending an event and subtract it when its application acknowledgement arrives. Repeat many messages and report sample count, median, and a percentile (e.g., p95), not just a single best value. This measures client-to-server processing plus acknowledgement return time (application round-trip), not one-way network delay. One-way delay estimates require synchronized clocks and careful timestamping.

## TCP acknowledgements versus application acknowledgements

A TCP ACK confirms receipt of byte sequence numbers at the transport layer; it does not mean the chat server validated or stored a message. A Socket.IO acknowledgement callback is an application-level response from the event handler. In this project, the successful message acknowledgement is sent after the database save and broadcast decision. Keep these two meanings distinct in a demonstration.

## Practical Wireshark guide

1. Start the frontend and backend, then open Wireshark. On Windows, choose the **Npcap Loopback Adapter** (or the installed loopback capture interface) for traffic to `localhost`. If using a LAN address or another machine, choose the active Ethernet/Wi-Fi interface instead. The interface graph should show packets when the app connects.
2. Start a capture, load the Vite page, sign in, then connect two browsers and send a message. Local development uses plain HTTP, so a capture can expose test passwords, cookies, and message contents. Use disposable test accounts only, never enter real credentials, do not capture on a public network, and do not share raw captures. Redact sensitive fields from screenshots.
3. Filter application TCP traffic for the development ports:

   ```text
   tcp.port == 5000 || tcp.port == 5173
   ```

   To focus on the backend alone, use `tcp.port == 5000`. To include only packets with TCP SYN set, use:

   ```text
   tcp.flags.syn == 1
   ```

4. Find the connection's initial three-way handshake: a client packet with `SYN=1, ACK=0`, a server reply with `SYN=1, ACK=1`, and the final client ACK. A display filter for the first SYN is:

   ```text
   tcp.flags.syn == 1 && tcp.flags.ack == 0
   ```

   Select a packet and use **Follow → TCP Stream** only with disposable test data in a private local development capture. Filter by the displayed source/destination ports and stream index to keep separate clients distinguishable.
5. Observe establishment when a new browser opens the app or Socket.IO connection. Observe graceful termination as FIN/ACK packets when a client disconnects; abrupt termination may use RST. Socket.IO may establish a persistent WebSocket after an HTTP Upgrade, or may continue to exchange Engine.IO HTTP polling requests.
6. To inspect the WebSocket upgrade, use:

   ```text
   http.request || websocket
   ```

   Depending on Wireshark version/dissection and the selected transport, WebSocket frames may be labeled `websocket`; polling appears as repeated HTTP requests/responses. Socket.IO event frames are application-level content inside the transport.
7. Capture genuine screenshots: show the selected interface and filter, the three handshake packets, and a clearly labeled WebSocket or polling exchange. Include the packet list and relevant packet-details pane, but hide/redact cookies, session IDs, usernames if private, and any credentials. Do not submit the unredacted capture file. Record what you actually observed and the date.

**Encryption caveat:** the local examples use `http://` and are normally unencrypted on loopback, but a deployed `https://` application encrypts HTTP and WebSocket payloads with TLS. A packet capture can still show network endpoints, TCP setup/teardown, timing, packet sizes, and TLS handshake metadata, but it cannot reveal protected application messages merely by following the TCP stream. Do not claim that encrypted chat text is readable without an authorized decryption setup.

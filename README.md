# Multi Client Chat Server

A simple Computer Networks project using Python TCP sockets and multithreading. Multiple clients can connect to one server, choose usernames, and exchange messages.

## Features

- TCP communication using `socket.AF_INET` and `socket.SOCK_STREAM`
- Server address: `127.0.0.1:5555`
- Multiple simultaneous clients
- One thread for each connected client
- Username-based messages
- Join and leave notifications
- Graceful client disconnection

## Project Structure

```text
Multi_Client_Chat_Server/
├── server.py
├── client.py
└── README.md
```

## Requirements

- Python 3
- Windows Command Prompt, PowerShell, or VS Code terminal

No external packages are required.

## How to Run

1. Open a terminal in the project folder.
2. Start the server:

```text
py -3 server.py
```

3. Open one or more additional terminals in the same folder.
4. Start a client in each terminal:

```text
py -3 client.py
```

5. Enter a username when prompted.
6. Type messages and press Enter.
7. Type `quit` to leave the chat.

## Example

```text
Alice: Hello everyone
Bob: Hi Alice
```

Messages are sent to all other connected clients. The sender does not receive a second copy of their own message.

## Testing

The project can be tested using multiple terminals:

1. Start the server.
2. Connect one client and verify the connection message.
3. Connect two or three clients and verify join notifications.
4. Send messages in both directions.
5. Send several messages from different clients.
6. Type `quit` in one client and verify the leave notification.
7. Press `Ctrl+C` in the server terminal to stop the server.

## Technologies

- Python
- TCP/IP
- Socket programming
- Multithreading
- Client-server architecture

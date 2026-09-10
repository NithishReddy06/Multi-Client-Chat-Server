import socket
import threading

HOST = "127.0.0.1"
PORT = 5555

clients = []
client_names = {}
clients_lock = threading.Lock()


def broadcast(message, sender=None):
    """Send a message to every connected client except the sender."""
    with clients_lock:
        recipients = [client for client in clients if client != sender]

    disconnected_clients = []
    for client in recipients:
        try:
            client.sendall(message.encode("utf-8"))
        except OSError:
            disconnected_clients.append(client)

    for client in disconnected_clients:
        remove_client(client)


def remove_client(client):
    """Remove a client from the active client list."""
    with clients_lock:
        if client not in clients:
            return

        clients.remove(client)
        name = client_names.pop(client, "Unknown")

    try:
        client.close()
    except OSError:
        pass

    broadcast(f"{name} left the chat.")
    print(f"{name} disconnected.")


def handle_client(client, address):
    """Receive messages from one client and broadcast them."""
    try:
        name = client.recv(1024).decode("utf-8").strip()
        if not name:
            name = f"{address[0]}:{address[1]}"

        with clients_lock:
            client_names[client] = name

        print(f"{name} connected from {address}")
        broadcast(f"{name} joined the chat.", sender=client)
        client.sendall("Connected to the chat server.\n".encode("utf-8"))

        while True:
            message = client.recv(1024).decode("utf-8")
            if not message:
                break

            message = message.strip()
            if message:
                print(f"{name}: {message}")
                broadcast(f"{name}: {message}", sender=client)
    except (ConnectionResetError, OSError):
        pass
    finally:
        remove_client(client)


def start_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen()

    print(f"Chat server is running on {HOST}:{PORT}")
    print("Waiting for clients...")

    try:
        while True:
            client, address = server.accept()
            with clients_lock:
                clients.append(client)

            thread = threading.Thread(
                target=handle_client,
                args=(client, address),
                daemon=True,
            )
            thread.start()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        with clients_lock:
            connected_clients = clients[:]
            clients.clear()
            client_names.clear()

        for client in connected_clients:
            client.close()
        server.close()


if __name__ == "__main__":
    start_server()

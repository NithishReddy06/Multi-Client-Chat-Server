import socket
import threading

HOST = "127.0.0.1"
PORT = 5555


def receive_messages(client):
    """Receive and display messages from the server."""
    while True:
        try:
            message = client.recv(1024).decode("utf-8")
            if not message:
                print("Disconnected from the server.", flush=True)
                break
            print(message, flush=True)
        except (ConnectionResetError, OSError):
            print("Disconnected from the server.", flush=True)
            break


def start_client():
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    try:
        client.connect((HOST, PORT))
    except ConnectionRefusedError:
        print("Could not connect to the server.")
        client.close()
        return

    name = input("Enter your name: ").strip()
    if not name:
        name = "Anonymous"

    try:
        client.sendall(name.encode("utf-8"))
    except OSError:
        print("Connection to the server was lost.")
        client.close()
        return

    receive_thread = threading.Thread(
        target=receive_messages,
        args=(client,),
        daemon=True,
    )
    receive_thread.start()

    print("Type messages and press Enter. Type 'quit' to leave.")

    try:
        while True:
            message = input()
            if message.lower() == "quit":
                break
            if message.strip():
                try:
                    client.sendall(message.encode("utf-8"))
                except OSError:
                    print("Connection to the server was lost.")
                    break
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        client.close()
        print("You left the chat.")


if __name__ == "__main__":
    start_client()

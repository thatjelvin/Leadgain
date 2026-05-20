import net from "node:net";

function readResponse(socket: net.Socket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      cleanup();
      resolve(chunk.toString("utf-8"));
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("SMTP timeout"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(socket: net.Socket, command: string, timeoutMs: number) {
  socket.write(`${command}\r\n`);
  return readResponse(socket, timeoutMs);
}

export async function smtpVerifyMailbox(mxHost: string, email: string) {
  const timeoutMs = 5000;

  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: mxHost, port: 25 });

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("connect", async () => {
      try {
        await readResponse(socket, timeoutMs);
        await sendCommand(socket, "EHLO leadforge.app", timeoutMs);
        await sendCommand(socket, "MAIL FROM:<verify@leadforge.app>", timeoutMs);
        const rcptResponse = await sendCommand(socket, `RCPT TO:<${email}>`, timeoutMs);

        socket.end("QUIT\r\n");

        if (rcptResponse.includes("250")) {
          resolve(true);
          return;
        }

        resolve(false);
      } catch {
        socket.destroy();
        resolve(false);
      }
    });
  });
}

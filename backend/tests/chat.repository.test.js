import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

process.env.CLIENT_URL ??= "http://localhost:5173";

test(
  "PostgreSQL stores related messages and returns the latest 50 chronologically",
  { skip: !process.env.DATABASE_URL && "Set DATABASE_URL in backend/.env to run PostgreSQL tests." },
  async () => {
    const [{ prisma }, repository] = await Promise.all([
      import("../services/database.js"),
      import("../services/chat.repository.js"),
    ]);
    const suffix = randomUUID();
    const roomName = `test-${suffix}`;
    const username = `test-${suffix}`;
    let room;
    let user;

    try {
      await prisma.$connect();
      room = await repository.getOrCreateRoom(roomName);
      user = await prisma.user.create({
        data: { username, passwordHash: "test-only-placeholder-hash" },
      });

      const membership = await prisma.roomMembership.create({
        data: { userId: user.id, roomId: room.id },
        include: { user: true, room: true },
      });
      assert.equal(membership.user.id, user.id);
      assert.equal(membership.room.id, room.id);

      const saved = await repository.createMessage({
        senderId: user.id,
        senderDisplayName: username,
        roomId: room.id,
        messageText: "related message",
      });
      const savedRecord = await prisma.message.findUnique({
        where: { id: saved.id },
        include: { sender: true, room: true },
      });
      assert.equal(savedRecord.sender.id, user.id);
      assert.equal(savedRecord.room.id, room.id);

      await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          repository.createMessage({
            senderDisplayName: username,
            roomId: room.id,
            messageText: `concurrent-${index}`,
          }),
        ),
      );

      for (let index = 0; index < 55; index += 1) {
        await repository.createMessage({
          senderDisplayName: username,
          roomId: room.id,
          messageText: `history-${index}`,
        });
        await new Promise((resolve) => setTimeout(resolve, 2));
      }

      const history = await repository.getLatestMessages(room.id);
      assert.equal(history.length, 50);
      assert.equal(history[0].content, "history-5");
      assert.equal(history.at(-1).content, "history-54");
      assert.deepEqual(
        history.map(({ createdAt }) => Date.parse(createdAt)),
        history
          .map(({ createdAt }) => Date.parse(createdAt))
          .toSorted((first, second) => first - second),
      );

      await assert.rejects(
        repository.createMessage({
          senderDisplayName: username,
          roomId: `missing-${suffix}`,
          messageText: "invalid room",
        }),
      );
      await assert.rejects(
        repository.createMessage({
          senderId: `missing-${suffix}`,
          senderDisplayName: username,
          roomId: room.id,
          messageText: "invalid sender",
        }),
      );
    } finally {
      try {
        if (room) await prisma.room.delete({ where: { id: room.id } });
        if (user) await prisma.user.delete({ where: { id: user.id } });
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);

import { prisma } from "./database.js";

const MESSAGE_HISTORY_LIMIT = 50;

function toClientMessage(message) {
  return {
    id: message.id,
    senderId: message.senderId,
    username: message.senderDisplayName,
    content: message.messageText,
    roomId: message.roomId,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getOrCreateRoom(roomName) {
  return prisma.room.upsert({
    where: { roomName },
    create: { roomName },
    update: {},
  });
}

export async function getRoomForMember(userId, roomName) {
  return prisma.room.findFirst({
    where: {
      roomName,
      memberships: { some: { userId } },
    },
  });
}

export async function getLatestMessages(roomId) {
  if (typeof roomId !== "string" || !roomId) {
    throw new TypeError("roomId must be a non-empty string.");
  }

  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MESSAGE_HISTORY_LIMIT,
  });

  return messages.reverse().map(toClientMessage);
}

export async function createMessage({
  senderId = null,
  senderDisplayName,
  roomId,
  messageText,
}) {
  if (typeof senderDisplayName !== "string" || !senderDisplayName.trim()) {
    throw new TypeError("senderDisplayName must be a non-empty string.");
  }
  if (typeof roomId !== "string" || !roomId) {
    throw new TypeError("roomId must be a non-empty string.");
  }
  if (typeof messageText !== "string" || !messageText.trim()) {
    throw new TypeError("messageText must be a non-empty string.");
  }

  const message = await prisma.message.create({
    data: {
      senderId,
      senderDisplayName,
      roomId,
      messageText,
    },
  });

  return toClientMessage(message);
}

export const chatRepository = {
  getOrCreateRoom,
  getRoomForMember,
  getLatestMessages,
  createMessage,
};

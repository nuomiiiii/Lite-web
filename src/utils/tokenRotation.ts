const rotationInProgressMessages = new Set([
  "a token rotation is already in progress",
]);

export function localizeTokenRotationError(message: unknown) {
  if (typeof message !== "string" || !message.trim()) return "Token 轮换失败";
  if (rotationInProgressMessages.has(message.trim().toLocaleLowerCase())) {
    return "Token 轮换仍在过渡期内，请先使用新 Token 重新部署 Agent；新 Token 首次成功连接后才能再次轮换";
  }
  return message;
}

type Flow = {
  email: string;
  resetToken?: string;
};

let flow: Flow | null = null;
let resetDone = false;

export function setForgotEmail(email: string) {
  flow = { email };
}

export function getForgotEmail() {
  return flow?.email;
}

export function setResetToken(token: string) {
  if (!flow) return;
  flow = { ...flow, resetToken: token };
}

export function getResetToken() {
  return flow?.resetToken;
}

export function markResetDone() {
  flow = null;
  resetDone = true;
}

export function peekResetDone() {
  return resetDone;
}

export function clearResetDone() {
  resetDone = false;
}

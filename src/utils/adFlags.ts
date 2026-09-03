let isLoggingOut = false;

export function setAdLoggingOut(value: boolean) {
  isLoggingOut = value;
}

export function getIsAdLoggingOut(): boolean {
  return isLoggingOut;
}

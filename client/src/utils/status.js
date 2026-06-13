export function statusText(status) {
  return {
    open: '開放中',
    full: '已滿員',
    closed: '已關閉',
    pending: '審核中',
    accepted: '已接受',
    rejected: '已拒絕'
  }[status] || status
}

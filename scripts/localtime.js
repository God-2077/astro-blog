// 获取本地时间
// 例如：2026-03-21 14:35:46

const date = new Date();
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const hour = String(date.getHours()).padStart(2, '0');
const minute = String(date.getMinutes()).padStart(2, '0');
const second = String(date.getSeconds()).padStart(2, '0');

console.log(`localtime: ${year}-${month}-${day} ${hour}:${minute}:${second}`);

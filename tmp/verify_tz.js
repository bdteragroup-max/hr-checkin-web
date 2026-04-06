const now = new Date();
const bkkString = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
const bkkFakeDate = new Date(bkkString);

console.log("Actual UTC:", now.toISOString());
console.log("BKK String:", bkkString);
console.log("BKK Fake Date (UTC representation):", bkkFakeDate.toISOString());
console.log("Difference (ms):", bkkFakeDate.getTime() - now.getTime());
console.log("Difference (hours):", (bkkFakeDate.getTime() - now.getTime()) / 3600000);


const offset = new Date().getTimezoneOffset();
console.log("Timezone Offset (minutes):", offset);
console.log("Current Date:", new Date().toString());

const d1 = new Date(2026, 0, 15);
console.log("Jan 15 2026 Local:", d1.toString());
console.log("Jan 15 2026 ISO:", d1.toISOString());

const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

console.log("getLocalDateString(Jan 15):", getLocalDateString(d1));

// Simulate MonthlyCalendar loop for Jan 2026
const year = 2026;
const month = 0;
console.log("--- MonthlyCalendar Loop ---");
for (let i = 14; i <= 17; i++) {
    const d = new Date(year, month, i);
    console.log(`Day ${i}: ${d.toString()} -> Key: ${getLocalDateString(d)}`);
}

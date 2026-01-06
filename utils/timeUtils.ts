export const timeToMinutes = (timeStr: string): number => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = modifier === 'AM' ? 0 : 12;
    else if (modifier === 'PM') hours += 12;
    return hours * 60 + (minutes || 0);
};

export const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const paddedMinutes = m < 10 ? `0${m}` : String(m);
    return `${hour12}:${paddedMinutes} ${ampm}`;
};

export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;
    return minutesToTime(endMinutes);
};

export const QUOTA_LIMIT = 1_000_000;
const STORAGE_KEY = 'tokenUsage';

interface StoredUsage {
  date: string;
  tokens: number;
}

export const getTodaysTokenUsage = (): number => {
  const storedUsage = localStorage.getItem(STORAGE_KEY);
  if (storedUsage) {
    try {
      const { date, tokens }: StoredUsage = JSON.parse(storedUsage);
      const today = new Date().toISOString().split('T')[0];
      if (date === today) {
        return tokens;
      }
    } catch (error) {
      console.error("Failed to parse token usage from localStorage", error);
    }
  }
  // If no stored usage, or it's from a different day, or parsing failed
  localStorage.removeItem(STORAGE_KEY);
  return 0;
};

export const saveTodaysTokenUsage = (tokens: number): void => {
  const today = new Date().toISOString().split('T')[0];
  const usage: StoredUsage = { date: today, tokens };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch (error) {
    console.error("Failed to save token usage to localStorage", error);
  }
};


export interface ExchangeRates {
  [key: string]: number;
}

class ExchangeService {
  private cache: { rates: ExchangeRates; timestamp: number } | null = null;
  private CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  async getRates(base: string = 'USD'): Promise<ExchangeRates> {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
      return this.cache.rates;
    }

    try {
      // Using a free, reliable exchange rate API
      const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      const data = await response.json();
      
      if (data.result === 'success') {
        this.cache = {
          rates: data.rates,
          timestamp: Date.now()
        };
        return data.rates;
      }
      throw new Error('Failed to fetch rates');
    } catch (error) {
      console.error('Exchange rates fetch error:', error);
      // Fallback rates if API is down
      return {
        USD: 1,
        EUR: 0.92,
        GBP: 0.78,
        CAD: 1.36,
        AUD: 1.51,
        JPY: 157.50
      };
    }
  }
}

export const exchangeService = new ExchangeService();

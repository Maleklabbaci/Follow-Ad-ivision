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
        // We curate the list to keep it clean, as requested: "Keep USD and add DZD"
        // We include a few others for common utility, but ensure DZD is at the requested rate.
        const importantCodes = ['USD', 'EUR', 'GBP', 'CAD', 'AED'];
        const rates: ExchangeRates = {};
        
        importantCodes.forEach(code => {
          if (data.rates[code]) rates[code] = data.rates[code];
        });

        // Inject DZD with the specific requested fixed rate (1 USD = 272 DZD)
        rates['DZD'] = 272;
        
        this.cache = {
          rates,
          timestamp: Date.now()
        };
        return rates;
      }
      throw new Error('Failed to fetch rates');
    } catch (error) {
      console.error('Exchange rates fetch error:', error);
      // Fallback rates if API is down, strictly including USD and the requested DZD rate.
      return {
        USD: 1,
        EUR: 0.92,
        DZD: 272
      };
    }
  }
}

export const exchangeService = new ExchangeService();
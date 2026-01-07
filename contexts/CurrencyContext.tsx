import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { exchangeService, ExchangeRates } from '../services/exchangeService';

interface CurrencyContextType {
  currency: string;
  setCurrency: (c: string) => void;
  rates: ExchangeRates;
  convert: (amount: number, from?: string) => number;
  format: (amount: number, from?: string, precision?: number) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to USD as requested ("Laisse le USD")
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('app_currency') || 'USD');
  const [rates, setRates] = useState<ExchangeRates>({ USD: 1, DZD: 272 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const newRates = await exchangeService.getRates('USD');
      setRates(newRates);
    } catch (err) {
      console.error("Failed to load rates, using fallbacks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    localStorage.setItem('app_currency', c);
  };

  const convert = useCallback((amount: number, from: string = 'USD') => {
    if (!rates[currency] || !rates[from]) return amount;
    // Base is USD in our service. convert from -> USD -> target
    const amountInUsd = amount / rates[from];
    return amountInUsd * rates[currency];
  }, [rates, currency]);

  const format = useCallback((amount: number, from: string = 'USD', precision?: number) => {
    const converted = convert(amount, from);
    
    // Custom formatting for DZD to use "DA" or "DZD" clearly
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: precision !== undefined ? precision : (converted > 100 ? 0 : 2),
      maximumFractionDigits: precision !== undefined ? precision : (converted > 100 ? 0 : 2)
    };

    return new Intl.NumberFormat(currency === 'DZD' ? 'fr-DZ' : 'en-US', options).format(converted);
  }, [convert, currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, convert, format, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};
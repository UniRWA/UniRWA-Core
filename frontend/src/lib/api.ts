import { API_BASE } from '@/config/api';

export interface Asset {
    id: number;
    symbol: string;
    name: string;
    issuer: string;
    mock_address: string;
    nav: string;
    yield_apy: string;
    tvl: string;
    min_investment: string;
    asset_type: string;
    last_updated: string;
}

export interface Pool {
    address: string;
    asset_symbol: string;
    asset_name: string;
    status: 'filling' | 'funded';
    filled: number;
    threshold: number;
    participants: number;
    min_deposit: number;
    apy: string;
    nav: string;
    issuer: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

export function fetchAssets(): Promise<Asset[]> {
    return fetchJSON<Asset[]>(`${API_BASE}/assets`);
}

export function fetchAsset(symbol: string): Promise<Asset> {
    return fetchJSON<Asset>(`${API_BASE}/assets/${symbol}`);
}

export function fetchPools(): Promise<Pool[]> {
    return fetchJSON<Pool[]>(`${API_BASE}/pools`);
}

export function fetchPool(address: string): Promise<Pool> {
    return fetchJSON<Pool>(`${API_BASE}/pools/${address}`);
}

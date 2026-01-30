import { Injectable } from '@nestjs/common';

@Injectable()
export class BidasksStorageService {
  private readonly store = new Map<string, Record<string, any>>();

  setBidasks(
    data: Record<string, any>[],
  ): void {
    this.store.set('data', data);
  }

  getBidasks(): Record<string, any> | null {
    return this.store.get('data') || [];
  }

  clear(): void {
    this.store.delete('data');
  }
}

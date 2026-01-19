import { Injectable } from '@nestjs/common';

@Injectable()
export class BidasksStorageService {
  private readonly store = new Array<Record<string, any>>();

  add(data: Record<string, any>): void {
    this.store.push(data);
  }

  getAll(): Array<any> {
    return this.store;
  }
}

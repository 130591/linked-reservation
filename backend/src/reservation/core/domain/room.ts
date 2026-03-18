import { randomUUID } from 'crypto'

export class Room {
  private constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly price: number = 0) { }

  static create(name: string, price: number) {
    return new Room(randomUUID(), name, price)
  }

  getId() {
    return this.id
  }

  getPrice() {
    return this.price
  }
}
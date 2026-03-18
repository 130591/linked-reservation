import { Err, Ok, Result } from 'neverthrow'
import { DomainError } from './erros/ErrorDomain'

export class Email {
  private constructor(readonly value: string) { }
  static create(value: string): Result<Email, DomainError> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) ? new Ok(new Email(value)) : new Err(DomainError.INVALID_EMAIL())
  }
}

export class Phone {
  private constructor(readonly value: string) { }
  static create(value: string): Result<Phone, DomainError> {
    const phoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/
    return phoneRegex.test(value) ? new Ok(new Phone(value)) : new Err(DomainError.INVALID_PHONE())
  }
}

export class Cpf {
  private constructor(readonly value: string) { }
  static create(value: string): Result<Cpf, DomainError> {
    const cpf = value.replace(/[^\d]+/g, '')
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return new Err(DomainError.INVALID_CPF())

    const digits = cpf.split('').map(el => +el)
    const rest = (count: number) => (((digits.slice(0, count - 12).reduce((soma, el, index) => soma + el * (count - index), 0) * 10) % 11) % 10)

    const isValid = rest(10) === digits[9] && rest(11) === digits[10]
    return isValid ? new Ok(new Cpf(value)) : new Err(DomainError.INVALID_CPF())
  }
}
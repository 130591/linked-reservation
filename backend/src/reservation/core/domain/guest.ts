import { Err, Ok, Result } from 'neverthrow'
import { Cpf, Email, Phone } from './shared-values'
import { DomainError } from './erros/ErrorDomain'

export class GuestInfo {
  private constructor(
    private readonly name: string,
    private readonly email: Email,
    private readonly phone: Phone,
    private readonly cpf: Cpf,
  ) { }

  static create(name: string, email: string, phone: string, cpf: string): Result<GuestInfo, DomainError> {
    return Result.combine([
      name.trim().length === 0 ? new Err(DomainError.NAME_REQUIRED()) : new Ok(name.trim()),
      Email.create(email),
      Phone.create(phone),
      Cpf.create(cpf)
    ]).map(([n, e, p, c]) => new GuestInfo(n, e, p, c))
  }

  static createFromMap(guests: GuestInfo[]) {
    return [...guests.values()]
  }
}
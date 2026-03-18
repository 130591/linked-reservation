import { GuestInfo } from "@/reservation/core/domain"
import { DomainError } from "@/reservation/core/domain/erros"


describe('Scenario: Creation of Guest Information', () => {
  const validData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '11988887777',
    cpf: '111.444.777-35'
  }

  describe('Given that a customer provides their personal data for the reservation', () => {

    it('When all data are valid, then a GuestInfo object should be successfully created', () => {
      const result = GuestInfo.create(validData.name, validData.email, validData.phone, validData.cpf)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeInstanceOf(GuestInfo)
      }
    })

    it('But if the name is blank, then it should return a required name error', () => {
      const result = GuestInfo.create('   ', validData.email, validData.phone, validData.cpf)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toEqual(DomainError.NAME_REQUIRED())
      }
    })

    it('And if the email does not follow the standard format, then it should return an invalid email error', () => {
      const result = GuestInfo.create(validData.name, 'wrong-email', validData.phone, validData.cpf)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toEqual(DomainError.INVALID_EMAIL())
      }
    })

    it('Or if the phone is too short, then it should return an invalid phone error', () => {
      const result = GuestInfo.create(validData.name, validData.email, '123', validData.cpf)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toEqual(DomainError.INVALID_PHONE())
      }
    })

    it('And finally if the CPF is not valid, then it should prevent the creation of the guest', () => {
      const result = GuestInfo.create(validData.name, validData.email, validData.phone, '000.000.000-00')

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toEqual(DomainError.INVALID_CPF())
      }
    })
  })
})
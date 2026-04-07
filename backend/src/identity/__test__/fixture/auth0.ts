export class FakeAuth0Management {
  public created: any[] = []

  users = {
    create: jest.fn().mockImplementation(async (data: any) => {
      this.created.push(data)
      return { data: { user_id: `auth0|fake-${Date.now()}` } }
    }),
  }

  reset() {
    this.created = []
    this.users.create.mockClear()
  }
}

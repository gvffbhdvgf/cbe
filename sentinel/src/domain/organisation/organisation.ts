export type ExternalIdentifier = { issuer: string; value: string };
export type OrganisationStatus = 'active' | 'inactive' | 'suspended';
export type Organisation = {
  id: string;
  name: string;
  status: OrganisationStatus;
  externalIdentifier?: ExternalIdentifier;
  createdAt: Date;
};

export function createOrganisation(input: { name: string; externalIdentifier?: ExternalIdentifier }): Organisation {
  const name = input.name.trim();
  if (!name) throw new Error('Organisation name is required');
  let externalIdentifier: ExternalIdentifier | undefined;
  if (input.externalIdentifier) {
    const issuer = input.externalIdentifier.issuer.trim();
    const value = input.externalIdentifier.value.trim();
    if (!issuer || !value) throw new Error('Identifier issuer and value are required');
    externalIdentifier = { issuer, value };
  }
  return {
    id: `org_${crypto.randomUUID()}`,
    name,
    status: 'active',
    externalIdentifier,
    createdAt: new Date(),
  };
}

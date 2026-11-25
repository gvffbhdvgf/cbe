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
  if (name.length > 240) throw new Error('Organisation name must be 240 characters or fewer');
  let externalIdentifier: ExternalIdentifier | undefined;
  if (input.externalIdentifier) {
    const issuer = input.externalIdentifier.issuer.trim();
    const value = input.externalIdentifier.value.trim();
    if (!issuer || !value) throw new Error('Identifier issuer and value are required');
    if (issuer.length > 120) throw new Error('Identifier issuer must be 120 characters or fewer');
    if (value.length > 180) throw new Error('Identifier value must be 180 characters or fewer');
    externalIdentifier = { issuer, value };
  }
  return {
    id: crypto.randomUUID(),
    name,
    status: 'active',
    externalIdentifier,
    createdAt: new Date(),
  };
}

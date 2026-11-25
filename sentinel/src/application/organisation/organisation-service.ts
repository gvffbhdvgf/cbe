import { createOrganisation, type ExternalIdentifier } from '@/domain/organisation';

export type RegisterOrganisationInput = {
  name: string;
  externalIdentifier?: ExternalIdentifier;
};

export function validateNewOrganisation(input: RegisterOrganisationInput) {
  return createOrganisation(input);
}

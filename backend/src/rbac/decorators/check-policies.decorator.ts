import { SetMetadata } from '@nestjs/common';
import { AppAction, AppResource } from '../casl-ability.factory';

export const CHECK_POLICIES_KEY = 'check_policies';

export interface PolicyMetadata {
  resource: AppResource;
  action: AppAction;
}

export const CheckPolicies = (resource: AppResource, action: AppAction) =>
  SetMetadata(CHECK_POLICIES_KEY, { resource, action } as PolicyMetadata);

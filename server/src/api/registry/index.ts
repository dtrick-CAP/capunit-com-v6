import * as express from 'express';
import Account from '../../lib/Account';
import NHQMember from '../../lib/members/NHQMember';
import RegistryValueValidator from '../../lib/validator/validators/RegistryValues';
import { tokenMiddleware } from '../formtoken';
// CRUD functions
import get from './get';
import set from './set';

const validator = new RegistryValueValidator();

const router = express.Router();

router.use(Account.ExpressMiddleware);

router.get('/', get);
router.post(
	'/',
	NHQMember.ExpressMiddleware,
	tokenMiddleware,
	NHQMember.PermissionMiddleware('RegistryEdit'),
	RegistryValueValidator.PartialBodyExpressMiddleware(validator),
	set
);

export default router;

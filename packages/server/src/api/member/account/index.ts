/**
 * Copyright (C) 2020 Andrew Rioux
 *
 * This file is part of CAPUnit.com.
 *
 * CAPUnit.com is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * CAPUnit.com is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with CAPUnit.com.  If not, see <http://www.gnu.org/licenses/>.
 */

import { addAPI } from 'auto-client-api';
import { Validator } from 'common-lib';
import { Router } from 'express';
import { endpointAdder } from '../../../lib/API';
import createprospective from './capprospective/createprospective';
import finishaccount from './finishaccount';
import finishpasswordreset from './finishpasswordreset';
import requestnhqaccount from './nhq/requestaccount';
import requestnhqusername from './nhq/requestusername';
import registerdiscord from './registerdiscord';
import requestpasswordreset from './requestpasswordreset';

const router = Router();

const adder = endpointAdder(router) as () => () => void;

addAPI(Validator, adder, requestnhqusername);
addAPI(Validator, adder, requestnhqaccount);

addAPI(Validator, adder, createprospective);

addAPI(Validator, adder, finishaccount);
addAPI(Validator, adder, finishpasswordreset);
addAPI(Validator, adder, requestpasswordreset);
addAPI(Validator, adder, registerdiscord);

export default router;

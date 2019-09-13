import { EventObject } from 'common-lib';
import {
	AccountRequest,
	asyncErrorHandler,
	Event,
	Registry,
	streamAsyncGeneratorAsJSONArrayTyped
} from '../../../lib/internals';

export default asyncErrorHandler(async (req: AccountRequest, res) => {
	let count = 0;
	const registry = await Registry.Get(req.account, req.mysqlx);

	await streamAsyncGeneratorAsJSONArrayTyped<Event, EventObject>(
		res,
		req.account.getSortedEvents(),
		ev => {
			if (!ev.showUpcoming) {
				return false;
			}

			if (ev.endDateTime < Date.now()) {
				return false;
			}

			if (count > registry.values.Website.ShowUpcomingEventCount) {
				return false;
			}

			count++;

			return ev.toRaw();
		}
	);
});

import { Schema } from '@mysql/xdevapi';
import {
	AbsenteeInformation,
	CAPMemberContact,
	ExtraMemberInformation,
	MemberObject,
	MemberPermissions,
	MemberReference,
	MemberType,
	NoSQLDocument,
	RawNotificationObject,
	RawTeamObject,
	TaskObject
} from 'common-lib';
import { NotificationTargetType } from 'common-lib/index';
import { DateTime } from 'luxon';
import Account from '../Account';
import Event from '../Event';
import { areMemberReferencesTheSame } from '../Members';
import { collectResults, findAndBind, generateResults, modifyAndBind } from '../MySQLUtil';
import Task from '../Task';
import Team from '../Team';

export default abstract class MemberBase implements MemberObject {
	public static readonly useRiouxPermission = true;

	protected static async LoadExtraMemberInformation(
		memberID: MemberReference,
		schema: Schema,
		account: Account
	): Promise<ExtraMemberInformation> {
		if (memberID.type === 'Null') {
			throw new Error('Null member reference');
		}

		const extraMemberSchema = schema.getCollection<ExtraMemberInformation>(
			'ExtraMemberInformation'
		);

		const results = await collectResults(
			findAndBind(extraMemberSchema, {
				member: memberID,
				accountID: account.id
			})
		);

		if (results.length === 0) {
			const newInformation: ExtraMemberInformation = {
				accountID: account.id,
				member: memberID,
				temporaryDutyPositions: [],
				flight: null,
				teamIDs: [],
				absentee: null
			};

			extraMemberSchema.add(newInformation).execute();

			return newInformation;
		}

		results[0].temporaryDutyPositions = results[0].temporaryDutyPositions.filter(
			v => v.validUntil > +DateTime.utc()
		);

		results[0].temporaryDutyPositions = results[0].temporaryDutyPositions.filter(
			v => v.validUntil > Date.now()
		);

		return results[0];
	}

	/**
	 * CAPID
	 */
	public id: number | string;
	/**
	 * Contact information
	 */
	public contact: CAPMemberContact;
	/**
	 * The first name of the member
	 */
	public nameFirst: string;
	/**
	 * The middle name of the member
	 */
	public nameMiddle: string;
	/**
	 * The last name of the member
	 */
	public nameLast: string;
	/**
	 * The suffix of the user
	 */
	public nameSuffix: string;
	/**
	 * The User ID, usually can be used for logins
	 */
	public usrID: string;
	/**
	 * The IDs of teams the member is a part of
	 */
	public teamIDs: number[] = [];
	/**
	 * Shows how long the member is absent for
	 *
	 * Should not be used if null or if the time has passed
	 */
	public absenteeInformation: AbsenteeInformation | null;
	/**
	 * Controls what the user can do
	 */
	public permissions: MemberPermissions;
	/**
	 * Whether or not the user is Rioux
	 */
	public readonly isRioux: boolean = false;
	/**
	 * Cheap way to produce references
	 */
	public abstract getReference: () => MemberReference;

	/**
	 * Used to differentiate when using polymorphism
	 *
	 * Another method is the instanceof operator, but to each their own
	 */
	public abstract type: MemberType;

	public constructor(
		data: MemberObject,
		protected schema: Schema,
		protected requestingAccount: Account,
		protected extraInformation: ExtraMemberInformation
	) {
		this.isRioux = (data.id === 542488 || data.id === 546319) && data.type === 'CAPNHQMember';

		this.id = data.id;
		this.contact = data.contact;
		this.nameFirst = data.nameFirst;
		this.nameLast = data.nameLast;
		this.nameMiddle = data.nameMiddle;
		this.nameSuffix = data.nameSuffix;
		this.usrID = data.usrID;
		this.absenteeInformation = data.absenteeInformation;
		this.teamIDs = data.teamIDs;
		this.permissions = data.permissions;
	}

	public getName = (): string =>
		[this.nameFirst, this.nameMiddle, this.nameLast, this.nameSuffix]
			.filter(s => !!s)
			.map(value => value.trimLeft().trimRight())
			.map(value => value.replace(/\r\n/gm, ''))
			.map(value => value.replace(/(  +)/g, ' '))
			.map((value, i) => (i === 1 ? value.charAt(0) : value))
			.join(' ');

	public toRaw(): MemberObject {
		return {
			id: this.id,
			contact: this.contact,
			nameFirst: this.nameFirst,
			nameLast: this.nameLast,
			nameMiddle: this.nameMiddle,
			nameSuffix: this.nameSuffix,
			usrID: this.usrID,
			type: this.type,
			teamIDs: this.teamIDs,
			absenteeInformation: this.absenteeInformation,
			permissions: this.permissions
		};
	}

	public async *getTeams(): AsyncIterableIterator<Team> {
		const teamsCollection = this.schema.getCollection<RawTeamObject>('Teams');

		const reference = this.getReference();

		const teamFind = teamsCollection.find('true');

		const generator = generateResults(teamFind);

		for await (const i of generator) {
			let found =
				areMemberReferencesTheSame(i.cadetLeader, reference) ||
				areMemberReferencesTheSame(i.seniorCoach, reference) ||
				areMemberReferencesTheSame(i.seniorMentor, reference);

			if (found === false) {
				for (const ref of i.members) {
					if (areMemberReferencesTheSame(ref.reference, reference)) {
						found = true;
						break;
					}
				}
			}
			if (found) {
				yield Team.Get(i.id, this.requestingAccount, this.schema);
			}
		}
	}

	public matchesReference(ref: MemberReference): boolean {
		return ref.type === this.type && ref.id === this.id;
	}

	public getFullName() {
		return this.getName();
	}

	public isPOCOf(event: Event) {
		return event.isPOC(this);
	}

	public async getUnreadNotificationCount() {
		const notificationCollection = this.schema.getCollection<
			RawNotificationObject & Required<NoSQLDocument>
		>('Notifications');

		let count = 0;

		const generator = generateResults(
			findAndBind(notificationCollection, {
				target: {
					to: this.getReference()
				}
			})
		);

		for await (const notif of generator) {
			if (notif.read === false) {
				count++;
			}
		}

		if (this.requestingAccount.isAdmin(this.getReference())) {
			const accountGenerator = generateResults(
				findAndBind(notificationCollection, {
					target: {
						type: NotificationTargetType.ADMINS,
						accountID: this.requestingAccount.id
					}
				})
			);

			for await (const notif of accountGenerator) {
				if (notif.read === false) {
					count++;
				}
			}
		}

		return count;
	}

	public async getNotificationCount() {
		const notificationCollection = this.schema.getCollection<
			RawNotificationObject & Required<NoSQLDocument>
		>('Notifications');

		let count = 0;

		const generator = generateResults(
			findAndBind(notificationCollection, {
				target: {
					to: this.getReference()
				}
			})
		);

		for await (const _ of generator) {
			count++;
		}

		if (this.requestingAccount.isAdmin(this.getReference())) {
			const accountGenerator = generateResults(
				findAndBind(notificationCollection, {
					target: {
						type: NotificationTargetType.ADMINS,
						accountID: this.requestingAccount.id
					}
				})
			);

			for await (const _ of accountGenerator) {
				count++;
			}
		}

		return count;
	}

	public async getUnfinishedTaskCount() {
		const tasksCollection = this.schema.getCollection<TaskObject>('Tasks');

		let count = 0;

		const generator = generateResults(
			findAndBind(tasksCollection, {
				accountID: this.requestingAccount.id
			})
		);

		for await (const task of generator) {
			let found = false;
			for (const i of task.results) {
				if (this.matchesReference(i.tasked) && !i.done) {
					found = true;
					break;
				}
			}
			if (found) {
				count++;
			}
		}

		return count;
	}

	public async *getTasks(): AsyncIterableIterator<Task> {
		const tasksCollection = this.schema.getCollection<TaskObject & Required<NoSQLDocument>>(
			'Tasks'
		);

		const generator = generateResults(
			findAndBind(tasksCollection, {
				accountID: this.requestingAccount.id
			})
		);

		for await (const task of generator) {
			for (const i of task.results) {
				if (this.matchesReference(i.tasked)) {
					yield new Task(task, this.requestingAccount, this.schema);
				}
			}
		}
	}

	public async saveExtraMemberInformation(schema: Schema, account: Account) {
		const extraInfoCollection = schema.getCollection<ExtraMemberInformation>(
			'ExtraMemberInformation'
		);

		await modifyAndBind(extraInfoCollection, { member: this.getReference(), accountID: account.id })
			.patch(this.extraInformation)
			.execute();
	}

	public setAbsenteeInformation(info: AbsenteeInformation) {
		this.extraInformation.absentee = info;
	}

	public setFlight(flight: string) {
		this.extraInformation.flight = flight;
	}
}

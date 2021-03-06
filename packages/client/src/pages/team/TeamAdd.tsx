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

import { Either, hasPermission, Maybe, MaybeObj, Member, TeamPublicity } from 'common-lib';
import * as React from 'react';
import TeamForm, {
	collapseTeamEditToObject,
	TeamObjectEdit
} from '../../components/forms/usable-forms/TeamForm';
import Loader from '../../components/Loader';
import fetchApi from '../../lib/apis';
import Page, { PageProps } from '../Page';

interface TeamAddBaseState {
	team: TeamObjectEdit;
}

interface TeamAddMemberLoadingState {
	state: 'LOADING';
}

interface TeamAddMemberLoadedState {
	state: 'LOADED';

	members: Member[];
}

interface TeamAddMemberErrorState {
	state: 'ERROR';
}

type TeamAddMemberState =
	| TeamAddMemberErrorState
	| TeamAddMemberLoadedState
	| TeamAddMemberLoadingState;

interface TeamAddResultUnsubmittedState {
	result: 'UNSUBMITTED';
}

interface TeamAddResultErrorState {
	result: 'ERROR';
}

type TeamAddResultState = TeamAddResultErrorState | TeamAddResultUnsubmittedState;

type TeamAddState = TeamAddMemberState & TeamAddBaseState & TeamAddResultState;

export default class TeamAdd extends Page<PageProps, TeamAddState> {
	public state: TeamAddState = {
		team: {
			cadetLeader: Maybe.none(),
			seniorCoach: Maybe.none(),
			seniorMentor: Maybe.none(),
			description: '',
			members: [],
			name: '',
			visibility: TeamPublicity.PRIVATE
		},
		state: 'LOADING',
		result: 'UNSUBMITTED'
	};

	public constructor(props: PageProps) {
		super(props);

		this.onTeamChange = this.onTeamChange.bind(this);
		this.onTeamSubmit = this.onTeamSubmit.bind(this);
	}

	public async componentDidMount() {
		if (!this.props.member || !hasPermission('ManageTeam')()(this.props.member)) {
			return;
		}

		const memberEither = await fetchApi.member.memberList({}, {}, this.props.member.sessionID);

		if (Either.isLeft(memberEither)) {
			this.setState({
				state: 'ERROR',
				result: 'UNSUBMITTED',
				team: this.state.team
			});
		} else {
			this.setState({
				state: 'LOADED',
				members: memberEither.value,
				result: 'UNSUBMITTED',
				team: this.state.team
			});
		}
	}

	public render() {
		if (!this.props.member) {
			return <div>Please sign in</div>;
		}

		if (!hasPermission('ManageTeam')()(this.props.member)) {
			return <div>You do not have permission to do that action</div>;
		}

		if (this.state.state === 'LOADING') {
			return <Loader />;
		}

		if (this.state.state === 'ERROR') {
			return <div>There was an error loading the member list</div>;
		}

		return (
			<>
				{this.state.result === 'ERROR' ? (
					<div>There was an error creating the team</div>
				) : null}
				<TeamForm
					isTeamUpdate={false}
					memberList={this.state.members}
					onTeamChange={this.onTeamChange}
					onTeamFormSubmit={this.onTeamSubmit}
					team={this.state.team}
				/>
			</>
		);
	}

	private onTeamChange(team: TeamObjectEdit) {
		this.setState({
			team
		});
	}

	private async onTeamSubmit(team: MaybeObj<TeamObjectEdit>) {
		const teamObj = Maybe.flatMap(collapseTeamEditToObject)(team);

		if (!teamObj.hasValue) {
			return;
		}

		if (!this.props.member) {
			return;
		}

		if (!hasPermission('ManageTeam')()(this.props.member)) {
			return;
		}

		const newTeamEither = await fetchApi.team.create(
			{},
			teamObj.value,
			this.props.member.sessionID
		);

		if (Either.isLeft(newTeamEither)) {
			this.setState({
				result: 'ERROR'
			});
		} else {
			this.props.routeProps.history.push(`/team/${newTeamEither.value.id}`);
		}
	}
}

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

import * as React from 'react';
import Button from '../Button';
import DownloadDialogue from './DownloadDialogue';
import { FormBlock, Label, TextBox, TextInput } from '../forms/SimpleForm';
import { InputProps } from '../form-inputs/Input';
import {
	MemberReference,
	Maybe as M,
	Member,
	MaybeObj,
	getFullMemberName,
	toReference,
	areMembersTheSame
} from 'common-lib';

interface MemberInputProps extends InputProps<MaybeObj<MemberReference>> {
	memberList: Member[];
}

interface MemberInputState {
	open: boolean;
	selectedValue: Member | null;
	filterValues: any[];
}

export default class MemberSelector extends React.Component<MemberInputProps, MemberInputState> {
	public state: MemberInputState = {
		open: false,
		selectedValue: null,
		filterValues: []
	};

	constructor(props: MemberInputProps) {
		super(props);

		this.openDialogue = this.openDialogue.bind(this);
		this.setSelectedMember = this.setSelectedMember.bind(this);
		this.selectMember = this.selectMember.bind(this);
	}

	public render() {
		const memberRef: MaybeObj<MemberReference> = this.props.value ?? M.none();

		const targetMember = memberRef.hasValue
			? this.props.memberList.filter(areMembersTheSame(memberRef.value))[0]
			: null;

		return (
			<FormBlock name={this.props.name}>
				<Label />

				<TextBox>
					<Button onClick={this.openDialogue}>Select a member</Button>
					<DownloadDialogue<Member>
						open={this.state.open}
						multiple={false}
						overflow={400}
						title="Select a member"
						showIDField={false}
						displayValue={getFullMemberName}
						valuePromise={this.props.memberList}
						onCancel={() => this.selectMember(null)}
						filters={[
							{
								check: (member, input) => {
									if (input === '' || typeof input !== 'string') {
										return true;
									}

									try {
										return !!getFullMemberName(member).match(
											new RegExp(input, 'gi')
										);
									} catch (e) {
										return false;
									}
								},
								displayText: 'Member name',
								filterInput: TextInput
							}
						]}
						onValueClick={this.setSelectedMember}
						onValueSelect={this.selectMember}
						selectedValue={this.state.selectedValue}
					/>
				</TextBox>

				<Label>Member ID</Label>
				<TextInput
					disabled={true}
					name="id"
					value={targetMember ? targetMember.id.toString() : ''}
				/>

				<Label>Member name</Label>
				<TextInput
					disabled={true}
					name="name"
					value={targetMember ? getFullMemberName(targetMember) : ''}
				/>
			</FormBlock>
		);
	}

	private openDialogue() {
		this.setState({
			open: true
		});
	}

	private setSelectedMember(selectedValue: Member | null) {
		this.setState({
			selectedValue
		});
	}

	private selectMember(selectedValue: Member | null) {
		this.setState({
			selectedValue,
			open: false
		});

		const value: MaybeObj<MemberReference> = M.map(toReference)(M.fromValue(selectedValue));

		if (this.props.onChange) {
			this.props.onChange(value);
		}

		if (this.props.onUpdate) {
			this.props.onUpdate({
				name: this.props.name,
				value
			});
		}
	}
}

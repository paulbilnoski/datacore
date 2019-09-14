import React, { Component } from 'react';
import { Table } from 'semantic-ui-react';

type ProfileOtherProps = {
	playerData: any;
};

type ProfileOtherState = {
	missions: any[];
};

class ProfileOther extends Component<ProfileOtherProps, ProfileOtherState> {
	constructor(props: ProfileOtherProps) {
		super(props);

		this.state = {
			missions: []
		};
	}

	componentDidMount() {
		fetch('/structured/missions.json')
			.then(response => response.json())
			.then(missionData => {
				let missions = [];
				this.props.playerData.player.character.accepted_missions
					.concat(this.props.playerData.player.character.dispute_histories)
					.forEach(mission => {
                        let quest = missionData.find(m => (m.symbol === mission.symbol));
                        if (quest && quest.episode_title) {
						    mission.episode = quest.episode;
						    mission.episode_title = quest.episode_title;
                            mission.cadet = quest.cadet;

                            if (mission.episode > 0) {
                                mission.name = `Episode ${mission.episode} : ${mission.episode_title}`;
                            } else {
                                mission.name = mission.episode_title;
                            }

                            missions.push(mission);
                        }
                    });
                    
                missions = missions.sort((a,b) => (a.episode > b.episode ? 1 : b.episode > a.episode ? -1 : 0));

				this.setState({ missions });
			});
	}

	render() {
		const { playerData } = this.props;
		const { missions } = this.state;

		return (
			<div>
				<Table celled selectable striped collapsing unstackable compact="very">
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell width={2}>Activity</Table.HeaderCell>
							<Table.HeaderCell width={1}>Status</Table.HeaderCell>
							<Table.HeaderCell width={3}>Description</Table.HeaderCell>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{playerData.player.character.daily_activities.map((da, idx) =>
							da.status ? (
								<Table.Row key={idx}>
									<Table.Cell>{da.name}</Table.Cell>
									<Table.Cell>{da.status}</Table.Cell>
									<Table.Cell>{da.description}</Table.Cell>
								</Table.Row>
							) : (
								undefined
							)
						)}
					</Table.Body>
				</Table>

				<Table celled selectable striped collapsing unstackable compact="very">
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell width={3}>Completed missions</Table.HeaderCell>
							<Table.HeaderCell width={3}>Status</Table.HeaderCell>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{missions.map((mission, idx) => (
							<Table.Row key={idx}>
								<Table.Cell>{mission.name}</Table.Cell>
								<Table.Cell>
									Completed {mission.stars_earned} of {mission.total_stars} missions
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</div>
		);
	}
}

export default ProfileOther;

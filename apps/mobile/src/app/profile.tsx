import { useEffect, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { MyAccess } from '@/components/MyAccess';
import { Avatar, Card, EmptyNote, GhostButton, Meta, Screen } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { fetchMyEmployee, type HrEmployee } from '@/lib/hrApi';
import { useEssData } from '@/mock/EssDataContext';
import { ORGANIZATION, type EssProfile } from '@/mock/essMock';

function show(value: string) {
  return value.trim() ? value : '—';
}

export default function ProfileScreen() {
  const { profile: stored } = useEssData();
  const [live, setLive] = useState<HrEmployee | null>(null);
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    fetchMyEmployee()
      .then(setLive)
      .catch(() => setLive(null));
  }, []);

  const profile: EssProfile = {
    ...stored,
    firstName: live?.firstName || stored.firstName,
    lastName: live?.lastName || stored.lastName,
    employeeCode: live?.employeeCode || stored.employeeCode,
    title: live?.designation || stored.title,
    department: live?.departmentName || stored.department,
    location: live?.locationName || stored.location,
    workEmail: live?.email || stored.workEmail,
    teamName: live?.teamName || stored.teamName,
    managerName: live?.managerName || stored.managerName,
  };

  return (
    <Screen title="Profile" back>
      <Card>
        <Avatar name={`${profile.firstName} ${profile.lastName}`} size={64} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          {profile.firstName} {profile.lastName}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {profile.employeeCode} · {profile.title}
        </Text>
      </Card>

      <MyAccess />

      <Card>
        <Text style={section(colors.text)}>Profile</Text>
        <Meta label="Name" value={`${profile.firstName} ${profile.lastName}`} />
        <Meta label="Employee ID" value={profile.employeeCode} />
        <Meta label="Company Email" value={profile.workEmail} />
        <Meta label="Location" value={profile.location} />
        <Meta label="Primary Contact No." value={profile.workPhone} />
        <Meta label="Extension" value={show(profile.extension)} />
      </Card>

      <Card>
        <Text style={section(colors.text)}>Personal</Text>
        <Meta label="Blood Group" value={show(profile.bloodGroup)} />
        <Meta label="Date of Birth" value={show(profile.dateOfBirth)} />
        <Meta label="Nationality" value={show(profile.nationality)} />
        <Meta label="Marital Status" value={show(profile.maritalStatus)} />
        <Meta label="Marriage Date" value={show(profile.marriageDate)} />
        <Meta label="Spouse" value={show(profile.spouse)} />
        <Meta label="Place of Birth" value={show(profile.placeOfBirth)} />
        <Meta label="Residential Status" value={show(profile.residentialStatus)} />
        <Meta label="Father Name" value={show(profile.fatherName)} />
        <Meta label="Religion" value={show(profile.religion)} />
        <Meta label="Physically Challenged" value={show(profile.physicallyChallenged)} />
        <Meta label="International Employee" value={show(profile.internationalEmployee)} />
        <Meta label="Height" value={show(profile.height)} />
        <Meta label="Weight" value={show(profile.weight)} />
        <Meta label="Identification Mark" value={show(profile.identificationMark)} />
      </Card>

      <Card>
        <Text style={section(colors.text)}>Address</Text>
        <Meta label="Address" value={show(profile.address.lines)} />
        <Meta label="Name" value={show(profile.address.name)} />
        <Meta label="Email" value={show(profile.address.email)} />
        <Meta label="Phone 1" value={show(profile.address.phone1)} />
        <Meta label="Phone 2" value={show(profile.address.phone2)} />
        <Meta label="Mobile" value={show(profile.address.mobile)} />
      </Card>

      <Card>
        <Text style={section(colors.text)}>Education</Text>
        {profile.education.length === 0 ? <EmptyNote text="No data found." /> : null}
      </Card>

      <Card>
        <Text style={section(colors.text)}>Bank Account</Text>
        <Meta label="Bank Name" value={show(profile.bankName)} />
        <Meta label="Bank Account Number" value={show(profile.bankAccountNumber)} />
        <Meta label="Bank Branch" value={show(profile.bankBranch)} />
      </Card>

      <Card>
        <Text style={section(colors.text)}>PF Account</Text>
        <Text style={{ color: colors.text }}>{profile.pfAccount}</Text>
      </Card>

      <Card>
        <Text style={section(colors.text)}>Other IDs</Text>
        {profile.statutoryIds.map((item) => (
          <Meta key={item.label} label={item.label} value={`${item.value}${item.unverified ? ' · Unverified' : ''}`} />
        ))}
      </Card>

      {profile.family.map((member) => (
        <Card key={member.relation}>
          <Text style={section(colors.text)}>{member.relation}</Text>
          <Meta label="Name" value={show(member.name)} />
          <GhostButton
            label={familyOpen ? 'Hide details' : 'See details'}
            onPress={() => setFamilyOpen((value) => !value)}
          />
          {familyOpen ? (
            <>
              <Meta label="Date of Birth" value={show(member.dateOfBirth)} />
              <Meta label="Blood Group" value={show(member.bloodGroup)} />
              <Meta label="Gender" value={show(member.gender)} />
              <Meta label="Nationality" value={show(member.nationality)} />
            </>
          ) : null}
        </Card>
      ))}

      <Employment profile={profile} open={timelineOpen} onToggle={() => setTimelineOpen((v) => !v)} />

      <Card>
        <Text style={section(colors.text)}>Access card details</Text>
        <Meta label="Card No" value={show(profile.accessCardNo)} />
        <Meta label="Validity" value={show(profile.accessCardValidity)} />
      </Card>
      <Card>
        <Text style={section(colors.text)}>Previous assets</Text>
        {profile.previousAssets.length === 0 ? <EmptyNote text="No data found." /> : null}
      </Card>
    </Screen>
  );
}

function Employment({
  profile,
  open,
  onToggle,
}: {
  profile: EssProfile;
  open: boolean;
  onToggle: () => void;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <Card>
      <Text style={section(colors.text)}>Current Position</Text>
      <GhostButton label={open ? 'Hide timeline' : 'View timeline'} onPress={onToggle} />
      <Meta label="Organization" value={ORGANIZATION.name} />
      <Meta label="Organization code" value={ORGANIZATION.code} />
      <Meta label="Cost Center" value={show(profile.costCenter)} />
      <Meta label="Department" value={profile.department} />
      <Meta label="Team" value={show(profile.teamName)} />
      <Meta label="Designation" value={profile.title} />
      <Meta label="Division" value={show(profile.division)} />
      <Meta label="Grade" value={show(profile.grade)} />
      <Meta label="Location" value={profile.location} />
      <Meta label="Reporting To" value={show(profile.managerName)} />
      <Meta label="Shift" value={show(profile.shift)} />
      <Meta label="Web Login" value={show(profile.webLogin)} />
      {open ? (
        <>
          <Text style={{ color: colors.text }}>
            {profile.title} · {profile.department} · {profile.location}
          </Text>
          <Text style={section(colors.text)}>Previous</Text>
          {profile.previousPositions.length === 0 ? <EmptyNote text="No data found." /> : null}
        </>
      ) : null}
    </Card>
  );
}

function section(color: string) {
  return { color, fontSize: 16, fontWeight: '800' as const };
}

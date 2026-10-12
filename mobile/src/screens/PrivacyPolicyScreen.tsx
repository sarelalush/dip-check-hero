import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StaticInfoScreen } from '../components/StaticInfoScreen';
import { legalDocuments } from '../services/legalConsentService';
import type { RootStackParamList } from '../../App';
type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;
export function PrivacyPolicyScreen({ navigation }: Props) {
  return <StaticInfoScreen navigation={navigation}
    title={legalDocuments.privacy.title}
    subtitle={'גרסה ' + legalDocuments.version + ' · נוסח עבודה מקומי לפני הפצה'}
    sections={legalDocuments.privacy.sections} />;
}

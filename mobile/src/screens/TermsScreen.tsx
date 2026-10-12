import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StaticInfoScreen } from '../components/StaticInfoScreen';
import { legalDocuments } from '../services/legalConsentService';
import type { RootStackParamList } from '../../App';
type Props = NativeStackScreenProps<RootStackParamList, 'Terms'>;
export function TermsScreen({ navigation }: Props) {
  return <StaticInfoScreen navigation={navigation}
    title={legalDocuments.terms.title}
    subtitle={'גרסה ' + legalDocuments.version + ' · פניות: ' + legalDocuments.supportEmail + ' · נוסח עבודה'}
    sections={legalDocuments.terms.sections} />;
}

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { Card, EmptyNote, Screen, Segmented, SelectField } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { downloadMyDocument, fetchMyEmployee, type HrDocument } from '@/lib/hrApi';
import { useEssData } from '@/mock/EssDataContext';

const DOCUMENT_GROUPS = [
  'Employee Documents',
  'Brickred Documents',
  'Educational Certificates',
  'Past Employment Documents',
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastUpdatedLabel(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]}, ${year}`;
}

function fileKind(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'IMG';
  if (ext === 'doc' || ext === 'docx') return 'DOC';
  return 'FILE';
}

export default function DocumentsScreen() {
  const { documents } = useEssData();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [mine, setMine] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<'mine' | 'policies'>('mine');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const policies = useMemo(() => documents.filter((doc) => doc.owner === 'company'), [documents]);

  useEffect(() => {
    fetchMyEmployee()
      .then((employee) => {
        setMine(employee.documents ?? []);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load documents.'))
      .finally(() => setLoading(false));
  }, []);

  const rows = list === 'mine' ? mine : policies;
  const categories = useMemo(() => [...new Set(rows.map((doc) => doc.category))].sort(), [rows]);
  const visible = rows.filter((doc) => !category || doc.category === category);
  const groups = useMemo(() => {
    const known = new Set<string>(DOCUMENT_GROUPS);
    const named = DOCUMENT_GROUPS.map((name) => ({
      name,
      docs: visible.filter((doc) => doc.category === name),
    })).filter((group) => group.docs.length > 0);
    const extras = [...new Set(visible.map((doc) => doc.category))]
      .filter((name) => !known.has(name))
      .map((name) => ({ name, docs: visible.filter((doc) => doc.category === name) }));
    return [...named, ...extras];
  }, [visible]);

  async function onDownload(id: string, fileName: string) {
    setDownloadingId(id);
    setError(null);
    setNotice(null);
    try {
      await downloadMyDocument(id, fileName);
      setNotice(`${fileName} downloaded.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not download the file.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Screen title="Document Center" back>
      <Text style={{ color: colors.textSecondary }}>
        Files HR uploaded for you are here. Tap Download to save a copy.
      </Text>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {notice ? <Text style={{ color: brand.success, fontWeight: '700' }}>{notice}</Text> : null}
      <Segmented
        value={list}
        options={[
          ['mine', 'Mine'],
          ['policies', 'Policies'],
        ]}
        onChange={(next) => {
          setList(next);
          setCategory('');
          setNotice(null);
        }}
      />
      <SelectField
        label="Category"
        value={category}
        onChange={setCategory}
        options={[{ value: '', label: 'All categories' }, ...categories.map((item) => ({ value: item, label: item }))]}
      />
      {loading && list === 'mine' ? <EmptyNote text="Loading your documents…" /> : null}
      {!loading && groups.length === 0 ? (
        <EmptyNote
          text={
            list === 'mine'
              ? 'No documents yet. HR adds your files here.'
              : 'No company policies in this list.'
          }
        />
      ) : null}
      {groups.map((group) => (
        <View key={group.name} style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{group.name}</Text>
          {group.docs.map((doc) => {
            const name = 'fileName' in doc ? doc.fileName : doc.name;
            const kind = fileKind(name);
            const canDownload = list === 'mine';
            const busy = downloadingId === doc.id;
            return (
              <Card key={doc.id}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: brand.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: brand.primaryInk, fontWeight: '800', fontSize: 12 }}>{kind}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{name}</Text>
                    <Text style={{ color: colors.textSecondary }}>{doc.category}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      Updated {lastUpdatedLabel(doc.uploadedAt)}
                    </Text>
                  </View>
                </View>
                {canDownload ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Download ${name}`}
                    disabled={busy}
                    onPress={() => void onDownload(doc.id, name)}
                    style={{
                      backgroundColor: brand.primary,
                      borderRadius: 999,
                      paddingVertical: 12,
                      alignItems: 'center',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: brand.primaryInk, fontWeight: '800' }}>
                      {busy ? 'Downloading…' : 'Download'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: colors.textSecondary }}>Company policy · view only</Text>
                )}
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

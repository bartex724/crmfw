import { useMemo, useState } from 'react';
import { App as AntApp, Button, Card, Form, Input, InputNumber, Layout, Menu, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from './lib/api';
import { useUiStore } from './stores/ui.store';
import type { BoxRow, EventItemRow, EventRow, Item } from './lib/types';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

type ModuleKey = 'inventory' | 'events' | 'boxes';
type ItemStatus = EventItemRow['status'];

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const createCategorySchema = z.object({ name: z.string().min(1).max(120), description: z.string().max(255).optional().or(z.literal('')) });
const createItemSchema = z.object({ name: z.string().min(1).max(180), code: z.string().max(80).optional().or(z.literal('')), categoryId: z.string().uuid(), quantity: z.number().int().min(0).default(0), notes: z.string().max(2000).optional().or(z.literal('')) });
const createEventSchema = z.object({ name: z.string().min(1).max(180), eventDate: z.string().min(1), location: z.string().min(1).max(180), notes: z.string().max(2000).optional().or(z.literal('')) });
const addEventItemSchema = z.object({ itemId: z.string().uuid(), plannedQuantity: z.number().int().min(1) });
const createBoxSchema = z.object({ boxCode: z.string().min(1).max(80), name: z.string().min(1).max(120), notes: z.string().max(2000).optional().or(z.literal('')) });

type LoginForm = z.infer<typeof loginSchema>;
type CreateCategoryForm = z.infer<typeof createCategorySchema>;
type CreateItemForm = z.infer<typeof createItemSchema>;
type CreateEventForm = z.infer<typeof createEventSchema>;
type AddEventItemForm = z.infer<typeof addEventItemSchema>;
type CreateBoxForm = z.infer<typeof createBoxSchema>;

function errMsg(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function buildInventoryParams(search: string, categoryId: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set('layout', 'dense');
  params.set('sortBy', 'name');
  params.set('sortOrder', 'asc');
  if (search.trim()) params.set('search', search.trim());
  if (categoryId) params.set('categoryId', categoryId);
  return params;
}

export default function App(): JSX.Element {
  return <AntApp><RootApp /></AntApp>;
}

function RootApp(): JSX.Element {
  const queryClient = useQueryClient();
  const ant = AntApp.useApp();
  const authQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: api.me, retry: false });
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      ant.message.success('Logged in.');
    },
    onError: (error) => ant.message.error(errMsg(error, 'Login failed'))
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.removeQueries({ queryKey: ['inventory'] });
      queryClient.removeQueries({ queryKey: ['events'] });
      queryClient.removeQueries({ queryKey: ['boxes'] });
    }
  });

  if (authQuery.isLoading) return <div className="page-center"><Spin size="large" /></div>;

  if (authQuery.isError || !authQuery.data?.user) {
    return (
      <div className="login-shell">
        <Card className="login-card" bordered={false}>
          <Title level={3}>CRM Frontend MVP</Title>
          <Form layout="vertical" className="form-space" onFinish={loginForm.handleSubmit(async (v) => loginMutation.mutateAsync(v))}>
            <Form.Item label="Email"><Input {...loginForm.register('email')} /></Form.Item>
            <Form.Item label="Password"><Input.Password {...loginForm.register('password')} /></Form.Item>
            <Button type="primary" htmlType="submit" loading={loginMutation.isPending} className="full-btn">Login</Button>
          </Form>
        </Card>
      </div>
    );
  }

  return <MainShell userEmail={authQuery.data.user.email} userRole={authQuery.data.user.role} onLogout={() => logoutMutation.mutate()} />;
}

function MainShell(props: { userEmail: string; userRole: string; onLogout: () => void }): JSX.Element {
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  return (
    <Layout className="app-shell">
      <Sider width={250} className="app-sider">
        <div className="sider-brand">Warehouse CRM</div>
        <Menu mode="inline" selectedKeys={[activeModule]} items={[{ key: 'inventory', label: 'Inventory' }, { key: 'events', label: 'Events' }, { key: 'boxes', label: 'Boxes' }]} onClick={(e) => setActiveModule(e.key as ModuleKey)} />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div><Title level={4} style={{ margin: 0 }}>Frontend MVP</Title><Text type="secondary">{props.userEmail} | {props.userRole}</Text></div>
          <Button onClick={props.onLogout}>Logout</Button>
        </Header>
        <Content className="app-content">
          {activeModule === 'inventory' ? <InventoryModule /> : null}
          {activeModule === 'events' ? <EventsModule /> : null}
          {activeModule === 'boxes' ? <BoxesModule /> : null}
        </Content>
      </Layout>
    </Layout>
  );
}

function InventoryModule(): JSX.Element {
  const ant = AntApp.useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const params = useMemo(() => buildInventoryParams(search, categoryId), [search, categoryId]);
  const categoriesQuery = useQuery({ queryKey: ['inventory', 'categories'], queryFn: api.listCategories });
  const itemsQuery = useQuery({ queryKey: ['inventory', 'items', params.toString()], queryFn: () => api.listItems(params) });
  const categoryForm = useForm<CreateCategoryForm>({ resolver: zodResolver(createCategorySchema), defaultValues: { name: '', description: '' } });
  const itemForm = useForm<CreateItemForm>({ resolver: zodResolver(createItemSchema), defaultValues: { name: '', code: '', categoryId: '', quantity: 0, notes: '' } });

  const createCategory = useMutation({
    mutationFn: api.createCategory,
    onSuccess: async () => { categoryForm.reset(); await queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] }); ant.message.success('Category created.'); },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to create category'))
  });

  const createItem = useMutation({
    mutationFn: api.createItem,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] }); ant.message.success('Item created.'); },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to create item'))
  });

  const columns: ColumnsType<Item> = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code' },
    { title: 'Qty', dataIndex: 'quantity' },
    { title: 'Category', render: (_, row) => row.category?.name ?? '-' },
    { title: 'Availability', render: (_, row) => (row.isUnavailable ? <Tag color="red">Unavailable</Tag> : <Tag color="green">In stock</Tag>) }
  ];

  return (
    <Space direction="vertical" size="large" className="full-width">
      <Card title="Filters" extra={<Button onClick={() => itemsQuery.refetch()}>Refresh</Button>}>
        <Space wrap>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" style={{ width: 220 }} />
          <Select value={categoryId} onChange={setCategoryId} style={{ width: 220 }} options={[{ value: '', label: 'All categories' }, ...(categoriesQuery.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        </Space>
      </Card>

      <Card title="Create Category">
        <Form layout="inline" onFinish={categoryForm.handleSubmit(async (values) => createCategory.mutateAsync({ name: values.name.trim(), description: values.description?.trim() || undefined }))}>
          <Form.Item><Input {...categoryForm.register('name')} placeholder="Name" /></Form.Item>
          <Form.Item><Input {...categoryForm.register('description')} placeholder="Description" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={createCategory.isPending}>Add</Button>
        </Form>
      </Card>

      <Card title="Create Item">
        <Form layout="inline" onFinish={itemForm.handleSubmit(async (v) => createItem.mutateAsync({ name: v.name.trim(), code: v.code?.trim() || undefined, categoryId: v.categoryId, quantity: v.quantity, notes: v.notes?.trim() || undefined }))}>
          <Form.Item><Input {...itemForm.register('name')} placeholder="Name" /></Form.Item>
          <Form.Item><Input {...itemForm.register('code')} placeholder="Code" /></Form.Item>
          <Form.Item>
            <Controller control={itemForm.control} name="categoryId" render={({ field }) => (
              <Select value={field.value || undefined} onChange={field.onChange} style={{ width: 220 }} placeholder="Category" options={(categoriesQuery.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            )} />
          </Form.Item>
          <Form.Item><Controller control={itemForm.control} name="quantity" render={({ field }) => <InputNumber value={field.value} min={0} onChange={(n) => field.onChange(n ?? 0)} />} /></Form.Item>
          <Form.Item><Input {...itemForm.register('notes')} placeholder="Notes" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={createItem.isPending}>Add</Button>
        </Form>
      </Card>

      <Card title="Items">
        <Table rowKey="id" loading={itemsQuery.isLoading} dataSource={itemsQuery.data?.items ?? []} columns={columns} pagination={{ pageSize: 12 }} />
      </Card>
    </Space>
  );
}

function EventsModule(): JSX.Element {
  const ant = AntApp.useApp();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventItemIds, setSelectedEventItemIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ItemStatus>('PACKED');
  const [selectedBoxIdForEvent, setSelectedBoxIdForEvent] = useState<string>('');
  const listQuery = useQuery({ queryKey: ['events', 'list'], queryFn: api.listEvents });
  const detailQuery = useQuery({ queryKey: ['events', 'detail', selectedEventId], queryFn: () => api.getEvent(selectedEventId as string), enabled: Boolean(selectedEventId) });
  const boxesQuery = useQuery({ queryKey: ['boxes', 'for-events'], queryFn: () => api.listBoxes() });
  const catalogParams = useMemo(() => { const p = new URLSearchParams(); p.set('layout', 'compact'); p.set('sortBy', 'name'); p.set('sortOrder', 'asc'); return p; }, []);
  const catalogQuery = useQuery({ queryKey: ['inventory', 'items', 'catalog', catalogParams.toString()], queryFn: () => api.listItems(catalogParams) });
  const createForm = useForm<CreateEventForm>({ resolver: zodResolver(createEventSchema), defaultValues: { name: '', eventDate: '', location: '', notes: '' } });
  const addForm = useForm<AddEventItemForm>({ resolver: zodResolver(addEventItemSchema), defaultValues: { itemId: '', plannedQuantity: 1 } });

  const createEvent = useMutation({
    mutationFn: api.createEvent,
    onSuccess: async ({ event }) => { await queryClient.invalidateQueries({ queryKey: ['events', 'list'] }); setSelectedEventId(event.id); createForm.reset(); ant.message.success('Event created.'); },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to create event'))
  });

  const lifecycle = useMutation({
    mutationFn: async (input: { id: string; action: 'activate' | 'close' | 'reopen' }) => input.action === 'activate' ? api.activateEvent(input.id) : input.action === 'close' ? api.closeEvent(input.id) : api.reopenEvent(input.id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['events', 'list'] }); await queryClient.invalidateQueries({ queryKey: ['events', 'detail', selectedEventId] }); }
  });

  const addItem = useMutation({
    mutationFn: (values: AddEventItemForm) => api.addEventItem(selectedEventId as string, values),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['events', 'detail', selectedEventId] }); addForm.reset({ itemId: addForm.getValues('itemId'), plannedQuantity: 1 }); ant.message.success('Item added.'); },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to add event item'))
  });

  const statusUpdate = useMutation({
    mutationFn: (input: { eventItemId: string; status: ItemStatus }) => api.updateEventItemStatus(selectedEventId as string, input.eventItemId, { status: input.status, forceToPack: input.status === 'TO_PACK' ? true : undefined }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['events', 'detail', selectedEventId] }); ant.message.success('Status updated.'); },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to update status'))
  });

  const bulkUpdate = useMutation({
    mutationFn: (input: { eventItemIds: string[]; status: ItemStatus }) =>
      api.bulkUpdateEventItemStatus(selectedEventId as string, {
        eventItemIds: input.eventItemIds,
        status: input.status,
        forceToPack: input.status === 'TO_PACK' ? true : undefined
      }),
    onSuccess: async () => {
      setSelectedEventItemIds([]);
      await queryClient.invalidateQueries({ queryKey: ['events', 'detail', selectedEventId] });
      ant.message.success('Bulk status update complete.');
    },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to bulk update statuses'))
  });

  const eventBoxAction = useMutation({
    mutationFn: async (input: { action: 'add' | 'addMissing' | 'remove'; boxId: string }) => {
      if (input.action === 'add') {
        return api.addBoxToEvent(selectedEventId as string, input.boxId);
      }
      if (input.action === 'addMissing') {
        return api.addMissingBoxItems(selectedEventId as string, input.boxId);
      }
      return api.removeBoxFromEvent(selectedEventId as string, input.boxId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events', 'detail', selectedEventId] });
      ant.message.success('Event-box action complete.');
    },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to execute event-box action'))
  });

  const eventCols: ColumnsType<EventRow> = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Date', dataIndex: 'eventDate', render: (d: string) => d?.slice(0, 10) ?? '-' },
    { title: 'Location', dataIndex: 'location' },
    { title: 'Status', dataIndex: 'lifecycleStatus' },
    { title: '', render: (_, row) => <Button type={selectedEventId === row.id ? 'primary' : 'default'} onClick={() => { setSelectedEventId(row.id); setSelectedEventItemIds([]); }}>Open</Button> }
  ];

  return (
    <Space direction="vertical" size="large" className="full-width">
      <Card title="Create Event">
        <Form layout="inline" onFinish={createForm.handleSubmit(async (v) => createEvent.mutateAsync({ name: v.name.trim(), eventDate: new Date(`${v.eventDate}T00:00:00`).toISOString(), location: v.location.trim(), notes: v.notes?.trim() || undefined }))}>
          <Form.Item><Input {...createForm.register('name')} placeholder="Name" /></Form.Item>
          <Form.Item><Input {...createForm.register('eventDate')} type="date" /></Form.Item>
          <Form.Item><Input {...createForm.register('location')} placeholder="Location" /></Form.Item>
          <Form.Item><Input {...createForm.register('notes')} placeholder="Notes" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={createEvent.isPending}>Add</Button>
        </Form>
      </Card>

      <Card title="Events">
        <Table rowKey="id" dataSource={listQuery.data?.events ?? []} columns={eventCols} loading={listQuery.isLoading} pagination={{ pageSize: 8 }} />
      </Card>

      {selectedEventId ? (
        <Card title={`Event Detail ${detailQuery.data?.event?.name ? `- ${detailQuery.data.event.name}` : ''}`} extra={<Space><Button onClick={() => lifecycle.mutate({ id: selectedEventId, action: 'activate' })}>Activate</Button><Button onClick={() => lifecycle.mutate({ id: selectedEventId, action: 'close' })}>Close</Button><Button onClick={() => lifecycle.mutate({ id: selectedEventId, action: 'reopen' })}>Reopen</Button></Space>}>
          <Space direction="vertical" className="full-width" size="large">
            <Space wrap>
              <Tag color="blue">{detailQuery.data?.event?.lifecycleStatus ?? '-'}</Tag>
              {Object.entries(detailQuery.data?.statusCounts ?? {}).map(([k, v]) => <Tag key={k}>{`${k}:${String(v)}`}</Tag>)}
            </Space>
            <Form layout="inline" onFinish={addForm.handleSubmit(async (v) => addItem.mutateAsync(v))}>
              <Form.Item>
                <Controller control={addForm.control} name="itemId" render={({ field }) => (
                  <Select value={field.value || undefined} onChange={field.onChange} style={{ width: 340 }} placeholder="Inventory item" options={(catalogQuery.data?.items ?? []).map((i: Item) => ({ value: i.id, label: `${i.name} (${i.code}) qty:${i.quantity}` }))} />
                )} />
              </Form.Item>
              <Form.Item><Controller control={addForm.control} name="plannedQuantity" render={({ field }) => <InputNumber value={field.value} min={1} onChange={(n) => field.onChange(n ?? 1)} />} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={addItem.isPending}>Add Item</Button>
              <Button onClick={() => window.open(`/events/${selectedEventId}/exports/packing-list`, '_blank')}>Packing XLSX</Button>
              <Button onClick={() => window.open(`/events/${selectedEventId}/exports/post-event-report`, '_blank')}>Report XLSX</Button>
            </Form>
            <Space wrap>
              <Select
                value={selectedBoxIdForEvent || undefined}
                onChange={setSelectedBoxIdForEvent}
                style={{ width: 300 }}
                placeholder="Select box for event action"
                options={(boxesQuery.data?.boxes ?? []).map((box) => ({
                  value: box.id,
                  label: `${box.boxCode} - ${box.name}`
                }))}
              />
              <Button
                onClick={() =>
                  selectedBoxIdForEvent
                    ? eventBoxAction.mutate({ action: 'add', boxId: selectedBoxIdForEvent })
                    : ant.message.warning('Select box first.')
                }
              >
                Add Box To Event
              </Button>
              <Button
                onClick={() =>
                  selectedBoxIdForEvent
                    ? eventBoxAction.mutate({ action: 'addMissing', boxId: selectedBoxIdForEvent })
                    : ant.message.warning('Select box first.')
                }
              >
                Add Missing Items
              </Button>
              <Button
                danger
                onClick={() =>
                  selectedBoxIdForEvent
                    ? eventBoxAction.mutate({ action: 'remove', boxId: selectedBoxIdForEvent })
                    : ant.message.warning('Select box first.')
                }
              >
                Remove Box From Event
              </Button>
            </Space>
            <Space wrap>
              <Select value={bulkStatus} onChange={setBulkStatus} style={{ width: 160 }} options={[{ value: 'TO_PACK', label: 'TO_PACK' }, { value: 'PACKED', label: 'PACKED' }, { value: 'RETURNED', label: 'RETURNED' }, { value: 'LOSS', label: 'LOSS' }]} />
              <Button
                type="primary"
                disabled={selectedEventItemIds.length === 0}
                loading={bulkUpdate.isPending}
                onClick={() => bulkUpdate.mutate({ eventItemIds: selectedEventItemIds, status: bulkStatus })}
              >
                Bulk Update ({selectedEventItemIds.length})
              </Button>
            </Space>
            <Table<EventItemRow>
              rowKey="id"
              loading={detailQuery.isLoading}
              dataSource={detailQuery.data?.items ?? []}
              rowSelection={{
                selectedRowKeys: selectedEventItemIds,
                onChange: (keys) => setSelectedEventItemIds(keys.map(String))
              }}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Item', render: (_, row) => row.itemName ?? row.itemCode ?? '-' },
                { title: 'Planned', dataIndex: 'plannedQuantity' },
                { title: 'Box', dataIndex: 'boxLabel', render: (v: string | null) => v ?? '-' },
                { title: 'Status', dataIndex: 'status' },
                {
                  title: 'Change',
                  render: (_, row) => <EventStatusEditor initial={row.status} loading={statusUpdate.isPending} onSave={(status) => statusUpdate.mutate({ eventItemId: row.id, status })} />
                }
              ]}
            />
          </Space>
        </Card>
      ) : null}
    </Space>
  );
}

function EventStatusEditor(props: { initial: ItemStatus; loading: boolean; onSave: (status: ItemStatus) => void }): JSX.Element {
  const [status, setStatus] = useState<ItemStatus>(props.initial);
  return (
    <Space>
      <Select value={status} onChange={setStatus} style={{ width: 130 }} options={[{ value: 'TO_PACK', label: 'TO_PACK' }, { value: 'PACKED', label: 'PACKED' }, { value: 'RETURNED', label: 'RETURNED' }, { value: 'LOSS', label: 'LOSS' }]} />
      <Button size="small" onClick={() => props.onSave(status)} loading={props.loading}>Save</Button>
    </Space>
  );
}

function BoxesModule(): JSX.Element {
  const ant = AntApp.useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const params = useMemo(() => { const p = new URLSearchParams(); p.set('sortBy', 'boxCode'); p.set('sortOrder', 'asc'); if (search.trim()) p.set('search', search.trim()); return p; }, [search]);
  const listQuery = useQuery({ queryKey: ['boxes', 'list', params.toString()], queryFn: () => api.listBoxes(params) });
  const eventsQuery = useQuery({ queryKey: ['events', 'for-boxes'], queryFn: api.listEvents });
  const itemsParams = useMemo(() => { const p = new URLSearchParams(); p.set('layout', 'compact'); p.set('sortBy', 'name'); p.set('sortOrder', 'asc'); return p; }, []);
  const itemsQuery = useQuery({ queryKey: ['inventory', 'items', 'for-boxes', itemsParams.toString()], queryFn: () => api.listItems(itemsParams) });
  const form = useForm<CreateBoxForm>({ resolver: zodResolver(createBoxSchema), defaultValues: { boxCode: '', name: '', notes: '' } });

  const create = useMutation({
    mutationFn: api.createBox,
    onSuccess: async () => { form.reset(); await queryClient.invalidateQueries({ queryKey: ['boxes', 'list'] }); ant.message.success('Box created.'); },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to create box'))
  });

  const assignItems = useMutation({
    mutationFn: (input: { boxId: string; itemIds: string[] }) => api.assignBoxItems(input.boxId, { itemIds: input.itemIds }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boxes', 'list'] });
      ant.message.success('Box items assigned.');
    },
    onError: (error) => ant.message.error(errMsg(error, 'Unable to assign items'))
  });

  const addBoxToEvent = useMutation({
    mutationFn: (input: { eventId: string; boxId: string }) => api.addBoxToEvent(input.eventId, input.boxId),
    onSuccess: () => ant.message.success('Box added to event.'),
    onError: (error) => ant.message.error(errMsg(error, 'Unable to add box to event'))
  });

  const cols: ColumnsType<BoxRow> = [
    { title: 'Code', dataIndex: 'boxCode' },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Notes', dataIndex: 'notes', render: (v: string | null | undefined) => v ?? '-' },
    {
      title: '',
      render: (_, row) => (
        <Button type={selectedBoxId === row.id ? 'primary' : 'default'} onClick={() => setSelectedBoxId(row.id)}>
          Select
        </Button>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" className="full-width">
      <Card title="Create Box">
        <Form layout="inline" onFinish={form.handleSubmit(async (v) => create.mutateAsync({ boxCode: v.boxCode.trim().toUpperCase(), name: v.name.trim(), notes: v.notes?.trim() || undefined }))}>
          <Form.Item><Input {...form.register('boxCode')} placeholder="Box code" /></Form.Item>
          <Form.Item><Input {...form.register('name')} placeholder="Name" /></Form.Item>
          <Form.Item><Input {...form.register('notes')} placeholder="Notes" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={create.isPending}>Add</Button>
        </Form>
      </Card>
      <Card title="Boxes" extra={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" style={{ width: 220 }} />}>
        <Table rowKey="id" loading={listQuery.isLoading} dataSource={listQuery.data?.boxes ?? []} columns={cols} pagination={{ pageSize: 12 }} />
      </Card>
      <Card title="Box Assignments & Event Link">
        <Space direction="vertical" className="full-width" size="middle">
          <Space wrap>
            <Text>Selected Box:</Text>
            <Tag color={selectedBoxId ? 'blue' : 'default'}>{selectedBoxId || 'none'}</Tag>
          </Space>
          <Select
            mode="multiple"
            value={selectedItemIds}
            onChange={(vals) => setSelectedItemIds(vals)}
            style={{ width: '100%' }}
            placeholder="Select inventory items for the box"
            options={(itemsQuery.data?.items ?? []).map((item: Item) => ({
              value: item.id,
              label: `${item.name} (${item.code}) qty:${item.quantity}`
            }))}
          />
          <Button
            type="primary"
            loading={assignItems.isPending}
            onClick={() =>
              selectedBoxId
                ? assignItems.mutate({ boxId: selectedBoxId, itemIds: selectedItemIds })
                : ant.message.warning('Select a box first.')
            }
          >
            Replace Box Items
          </Button>
          <Select
            value={selectedEventId || undefined}
            onChange={setSelectedEventId}
            style={{ width: '100%' }}
            placeholder="Select event to link selected box"
            options={(eventsQuery.data?.events ?? []).map((event) => ({
              value: event.id,
              label: `${event.name} (${event.lifecycleStatus})`
            }))}
          />
          <Button
            onClick={() =>
              selectedBoxId && selectedEventId
                ? addBoxToEvent.mutate({ boxId: selectedBoxId, eventId: selectedEventId })
                : ant.message.warning('Select both box and event.')
            }
            loading={addBoxToEvent.isPending}
          >
            Add Selected Box To Event
          </Button>
        </Space>
      </Card>
    </Space>
  );
}

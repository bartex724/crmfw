import { useMemo } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from './lib/api';
import { useUiStore } from './stores/ui.store';
import type { Category, Item } from './lib/types';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(255).optional().or(z.literal(''))
});

const createItemSchema = z.object({
  name: z.string().min(1).max(180),
  code: z.string().max(80).optional().or(z.literal('')),
  categoryId: z.string().uuid(),
  quantity: z.number().int().min(0).default(0),
  notes: z.string().max(2000).optional().or(z.literal(''))
});

type LoginForm = z.infer<typeof loginSchema>;
type CreateCategoryForm = z.infer<typeof createCategorySchema>;
type CreateItemForm = z.infer<typeof createItemSchema>;

function buildItemsParams(filters: {
  search: string;
  categoryId: string;
  hideUnavailable: boolean;
  sortBy: 'name' | 'code' | 'quantity' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('layout', 'dense');
  params.set('sortBy', filters.sortBy);
  params.set('sortOrder', filters.sortOrder);
  if (filters.search.trim()) {
    params.set('search', filters.search.trim());
  }
  if (filters.categoryId) {
    params.set('categoryId', filters.categoryId);
  }
  if (filters.hideUnavailable) {
    params.set('hideUnavailable', 'true');
  }
  return params;
}

export default function App(): JSX.Element {
  return (
    <AntApp>
      <RootApp />
    </AntApp>
  );
}

function RootApp(): JSX.Element {
  const queryClient = useQueryClient();
  const ant = AntApp.useApp();

  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.me,
    retry: false
  });

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      ant.message.success('Logged in.');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      ant.message.error(message);
    }
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.removeQueries({ queryKey: ['inventory'] });
      queryClient.removeQueries({ queryKey: ['events'] });
      queryClient.removeQueries({ queryKey: ['boxes'] });
      ant.message.success('Logged out.');
    }
  });

  if (authQuery.isLoading) {
    return (
      <div className="page-center">
        <Spin size="large" />
      </div>
    );
  }

  if (authQuery.isError || !authQuery.data?.user) {
    return (
      <div className="login-shell">
        <Card className="login-card" bordered={false}>
          <Title level={3}>CRM Frontend MVP</Title>
          <Text type="secondary">Sign in with your backend account.</Text>
          <Form
            layout="vertical"
            className="form-space"
            onFinish={loginForm.handleSubmit(async (values) => {
              await loginMutation.mutateAsync(values);
            })}
          >
            <Form.Item
              label="Email"
              validateStatus={loginForm.formState.errors.email ? 'error' : ''}
              help={loginForm.formState.errors.email?.message}
            >
              <Input {...loginForm.register('email')} autoComplete="email" />
            </Form.Item>
            <Form.Item
              label="Password"
              validateStatus={loginForm.formState.errors.password ? 'error' : ''}
              help={loginForm.formState.errors.password?.message}
            >
              <Input.Password {...loginForm.register('password')} autoComplete="current-password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
              className="full-btn"
            >
              Login
            </Button>
          </Form>
        </Card>
      </div>
    );
  }

  return (
    <MainShell
      userEmail={authQuery.data.user.email}
      userRole={authQuery.data.user.role}
      onLogout={() => logoutMutation.mutate()}
    />
  );
}

function MainShell(props: {
  userEmail: string;
  userRole: string;
  onLogout: () => void;
}): JSX.Element {
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);

  return (
    <Layout className="app-shell">
      <Sider width={250} className="app-sider">
        <div className="sider-brand">Warehouse CRM</div>
        <Menu
          mode="inline"
          selectedKeys={[activeModule]}
          items={[
            { key: 'inventory', label: 'Inventory' },
            { key: 'events', label: 'Events' },
            { key: 'boxes', label: 'Boxes' }
          ]}
          onClick={(event) => setActiveModule(event.key as 'inventory' | 'events' | 'boxes')}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Frontend MVP
            </Title>
            <Text type="secondary">
              {props.userEmail} | {props.userRole}
            </Text>
          </div>
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
  const queryClient = useQueryClient();
  const ant = AntApp.useApp();

  const search = useUiStore((s) => s.search);
  const setSearch = useUiStore((s) => s.setSearch);
  const categoryId = useUiStore((s) => s.categoryId);
  const setCategoryId = useUiStore((s) => s.setCategoryId);
  const hideUnavailable = useUiStore((s) => s.hideUnavailable);
  const setHideUnavailable = useUiStore((s) => s.setHideUnavailable);
  const sortBy = useUiStore((s) => s.sortBy);
  const setSortBy = useUiStore((s) => s.setSortBy);
  const sortOrder = useUiStore((s) => s.sortOrder);
  const setSortOrder = useUiStore((s) => s.setSortOrder);

  const params = useMemo(
    () =>
      buildItemsParams({
        search,
        categoryId,
        hideUnavailable,
        sortBy,
        sortOrder
      }),
    [search, categoryId, hideUnavailable, sortBy, sortOrder]
  );

  const categoriesQuery = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: api.listCategories
  });

  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', params.toString()],
    queryFn: () => api.listItems(params)
  });

  const categoryForm = useForm<CreateCategoryForm>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });

  const itemForm = useForm<CreateItemForm>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: '',
      code: '',
      categoryId: '',
      quantity: 0,
      notes: ''
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: api.createCategory,
    onSuccess: async () => {
      categoryForm.reset();
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] });
      ant.message.success('Category created.');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Unable to create category';
      ant.message.error(message);
    }
  });

  const createItemMutation = useMutation({
    mutationFn: api.createItem,
    onSuccess: async () => {
      itemForm.reset({
        name: '',
        code: '',
        categoryId: itemForm.getValues('categoryId'),
        quantity: 0,
        notes: ''
      });
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
      ant.message.success('Item created.');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Unable to create item';
      ant.message.error(message);
    }
  });

  const categories = categoriesQuery.data?.categories ?? [];
  const items = itemsQuery.data?.items ?? [];

  return (
    <Space direction="vertical" size="large" className="full-width">
      <Card
        title="Inventory Filters"
        extra={
          <Button onClick={() => itemsQuery.refetch()} loading={itemsQuery.isRefetching}>
            Refresh
          </Button>
        }
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or code"
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: '', label: 'All categories' },
                ...categories.map((category) => ({ value: category.id, label: category.name }))
              ]}
              className="full-width"
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'name', label: 'Sort: Name' },
                { value: 'code', label: 'Sort: Code' },
                { value: 'quantity', label: 'Sort: Quantity' },
                { value: 'updatedAt', label: 'Sort: Updated' }
              ]}
              className="full-width"
            />
          </Col>
          <Col xs={12} md={3}>
            <Select
              value={sortOrder}
              onChange={setSortOrder}
              options={[
                { value: 'asc', label: 'ASC' },
                { value: 'desc', label: 'DESC' }
              ]}
              className="full-width"
            />
          </Col>
          <Col xs={24} md={4}>
            <Space>
              <Switch checked={hideUnavailable} onChange={setHideUnavailable} />
              <Text>Hide unavailable</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Create Category">
            <Form
              layout="vertical"
              onFinish={categoryForm.handleSubmit(async (values) => {
                await createCategoryMutation.mutateAsync({
                  name: values.name.trim(),
                  description: values.description?.trim() || undefined
                });
              })}
            >
              <Form.Item
                label="Name"
                validateStatus={categoryForm.formState.errors.name ? 'error' : ''}
                help={categoryForm.formState.errors.name?.message}
              >
                <Input {...categoryForm.register('name')} />
              </Form.Item>
              <Form.Item
                label="Description"
                validateStatus={categoryForm.formState.errors.description ? 'error' : ''}
                help={categoryForm.formState.errors.description?.message}
              >
                <Input {...categoryForm.register('description')} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={createCategoryMutation.isPending}>
                Add Category
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="Create Item">
            <Form
              layout="vertical"
              onFinish={itemForm.handleSubmit(async (values) => {
                await createItemMutation.mutateAsync({
                  name: values.name.trim(),
                  code: values.code?.trim() || undefined,
                  categoryId: values.categoryId,
                  quantity: values.quantity,
                  notes: values.notes?.trim() || undefined
                });
              })}
            >
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Name"
                    validateStatus={itemForm.formState.errors.name ? 'error' : ''}
                    help={itemForm.formState.errors.name?.message}
                  >
                    <Input {...itemForm.register('name')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Code"
                    validateStatus={itemForm.formState.errors.code ? 'error' : ''}
                    help={itemForm.formState.errors.code?.message}
                  >
                    <Input {...itemForm.register('code')} placeholder="Optional" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Category"
                    validateStatus={itemForm.formState.errors.categoryId ? 'error' : ''}
                    help={itemForm.formState.errors.categoryId?.message}
                  >
                    <Controller
                      control={itemForm.control}
                      name="categoryId"
                      render={({ field }) => (
                        <Select
                          {...field}
                          value={field.value || undefined}
                          onChange={field.onChange}
                          options={categories.map((category) => ({
                            value: category.id,
                            label: category.name
                          }))}
                          placeholder="Select category"
                        />
                      )}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Quantity"
                    validateStatus={itemForm.formState.errors.quantity ? 'error' : ''}
                    help={itemForm.formState.errors.quantity?.message}
                  >
                    <Controller
                      control={itemForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <InputNumber
                          min={0}
                          className="full-width"
                          value={field.value}
                          onChange={(value) => field.onChange(value ?? 0)}
                        />
                      )}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label="Notes"
                    validateStatus={itemForm.formState.errors.notes ? 'error' : ''}
                    help={itemForm.formState.errors.notes?.message}
                  >
                    <Input.TextArea rows={3} {...itemForm.register('notes')} />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" htmlType="submit" loading={createItemMutation.isPending}>
                Add Item
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card title="Items">
        {itemsQuery.isError ? (
          <Alert type="error" message="Failed to load items." showIcon />
        ) : (
          <Table<Item>
            rowKey="id"
            loading={itemsQuery.isLoading}
            dataSource={items}
            pagination={{ pageSize: 12 }}
            columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Code', dataIndex: 'code' },
              { title: 'Qty', dataIndex: 'quantity', width: 90 },
              {
                title: 'Category',
                render: (_, row) => row.category?.name ?? '-'
              },
              {
                title: 'Availability',
                render: (_, row) =>
                  row.isUnavailable ? <Tag color="red">Unavailable</Tag> : <Tag color="green">In stock</Tag>
              }
            ]}
          />
        )}
      </Card>
    </Space>
  );
}

function EventsModule(): JSX.Element {
  const eventsQuery = useQuery({
    queryKey: ['events', 'list'],
    queryFn: api.listEvents
  });

  return (
    <Card title="Events">
      <Text type="secondary">Read model for MVP. Full event workflows in next iteration.</Text>
      <Table
        className="top-gap"
        rowKey="id"
        loading={eventsQuery.isLoading}
        dataSource={eventsQuery.data?.events ?? []}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Date', dataIndex: 'eventDate', render: (value: string) => value?.slice(0, 10) ?? '-' },
          { title: 'Location', dataIndex: 'location' },
          { title: 'Status', dataIndex: 'lifecycleStatus' }
        ]}
      />
    </Card>
  );
}

function BoxesModule(): JSX.Element {
  const boxesQuery = useQuery({
    queryKey: ['boxes', 'list'],
    queryFn: api.listBoxes
  });

  return (
    <Card title="Boxes">
      <Text type="secondary">Read model for MVP. Box assignment and QR actions in next iteration.</Text>
      <Table
        className="top-gap"
        rowKey="id"
        loading={boxesQuery.isLoading}
        dataSource={boxesQuery.data?.boxes ?? []}
        columns={[
          { title: 'Code', dataIndex: 'boxCode' },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Notes', dataIndex: 'notes', render: (value: string | null | undefined) => value ?? '-' }
        ]}
      />
    </Card>
  );
}

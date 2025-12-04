<script lang="ts">
	import { InputField, AuthGuard } from 'luke-core-library';
	import { Button } from '@budget-suite/shared/components/button';
	import { Card } from '@budget-suite/shared/components/core';
</script>

<AuthGuard isAuthenticated={true}>
	<InputField label="Username" placeholder="Enter username" />
	<Button label="Submit" />
	<Card title="Welcome" />
</AuthGuard>

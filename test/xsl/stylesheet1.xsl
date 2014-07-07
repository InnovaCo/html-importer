<stylesheet>
	<template match="/*">
		<out>
			<header>Parent tag: {{ name() }}</header>
			<apply-templates select="body/*"/>
		</out>
	</template>

	<template match="*">
		<element name="{name()}">
			<apply-templates />
		</element>
	</template>

	<template match="text()">
		{{ normalize-space(.) }}
	</template>
</stylesheet>
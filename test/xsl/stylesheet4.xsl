<stylesheet>
	<param name="lang" value="'empty'"/>
	<template match="/">
		<div data-lang="{$lang}">
			<copy-of select="//body"/>
		</div>
	</template>
</stylesheet>
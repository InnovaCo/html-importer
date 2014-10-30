<stylesheet>
	<template match="/">
		<html>
			<head>
				<title>Transformed</title>
			</head>
			<body>
				<xsl:apply-templates select="html/body" mode="html-output"/>
			</body>
		</html>
	</template>

	<template match="*" mode="html-output">
		<apply-templates select="* | text()" mode="html"/>
	</template>

	<template match="@*" mode="html">
		<attribute name="{name()}">
			<value-of select="." disable-output-escaping="yes"/>
		</attribute>
		<!-- <copy-of select="." /> -->
	</template>
	
	<template match="*" mode="html">
		<element name="{name()}">
			<apply-templates select="@*" mode="html" />
			<apply-templates mode="html" />
		</element>
	</template>
</stylesheet>
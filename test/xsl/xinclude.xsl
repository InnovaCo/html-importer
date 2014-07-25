<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xsl:stylesheet SYSTEM "../xinclude/entities.dtd">
<xsl:stylesheet version="1.0" 
	xmlns:xi="http://www.w3.org/2001/XInclude"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	exclude-result-prefixes="xi">
	<xsl:template match="/document">
		<output>
			<p>Total files: <xsl:value-of select="count(files/file)"/></p>
			<p>Total items: <xsl:value-of select="count(items/item)"/></p>
			<xsl:apply-templates select="*"/>
		</output>
	</xsl:template>

	<xsl:template match="*">
		<xsl:element name="{name()}">
			<xsl:copy-of select="@*[not(contains(name(), ':'))]"/>
			<xsl:apply-templates select="* | text()"/>
		</xsl:element>
	</xsl:template>

	<xsl:template match="text()">
		<xsl:value-of select="normalize-space(.)"/>
	</xsl:template>
</xsl:stylesheet>
<?php
namespace MediaWiki\Skins\Vector\Components;

use Config;
use MessageLocalizer;

/**
 * VectorComponentTableOfContents component
 */
class VectorComponentTableOfContents implements VectorComponent {

	/** @var array */
	private $tocData;

	/** @var MessageLocalizer */
	private $localizer;

	/** @var bool */
	private $isPinned;

	/** @var Config */
	private $config;

	/** @var VectorComponentPinnableHeader */
	private $pinnableHeader;

	/** @var string */
	public const ID = 'vector-toc';

	/**
	 * @param array $tocData
	 * @param MessageLocalizer $localizer
	 * @param Config $config
	 */
	public function __construct(
		array $tocData,
		MessageLocalizer $localizer,
		Config $config
	) {
		$this->tocData = $tocData;
		$this->localizer = $localizer;
		// ToC is pinned by default, hardcoded for now
		$this->isPinned = true;
		$this->config = $config;
		$this->pinnableHeader = new VectorComponentPinnableHeader(
			$this->localizer,
			$this->isPinned,
			'vector-toc',
			null,
			false,
			'h2'
		);
	}

	/**
	 * In tableOfContents.js we have tableOfContents::getTableOfContentsSectionsData(),
	 * that yields the same result as this function, please make sure to keep them in sync.
	 * @inheritDoc
	 */
	public function getTemplateData(): array {
		// If the table of contents has no items, we won't output it.
		// empty array is interpreted by Mustache as falsey.
		if ( empty( $this->tocData ) || empty( $this->tocData[ 'array-sections' ] ) ) {
			return [];
		}

		// Populate button labels for collapsible TOC sections
		foreach ( $this->tocData[ 'array-sections' ] as &$section ) {
			if ( $section['is-top-level-section'] && $section['is-parent-section'] ) {
				$section['vector-button-label'] =
					$this->localizer->msg( 'vector-toc-toggle-button-label', $section['line'] )->text();
			}
		}

		$pinnedContainer = new VectorComponentPinnedContainer( self::ID );
		$pinnableElement = new VectorComponentPinnableElement( self::ID );

		return $pinnableElement->getTemplateData() +
			$pinnedContainer->getTemplateData() +
			array_merge( $this->tocData, [
			'is-vector-toc-beginning-enabled' => $this->config->get(
				'VectorTableOfContentsBeginning'
			),
			'vector-is-collapse-sections-enabled' =>
				$this->tocData[ 'number-section-count'] >= $this->config->get(
					'VectorTableOfContentsCollapseAtCount'
				),
			'data-pinnable-header' => $this->pinnableHeader->getTemplateData(),
		] );
	}
}

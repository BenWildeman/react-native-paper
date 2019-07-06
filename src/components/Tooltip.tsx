import * as React from 'react';
import {
  Dimensions,
  findNodeHandle,
  StyleSheet,
  UIManager,
  View,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import * as Colors from '../styles/colors';
import { APPROX_STATUSBAR_HEIGHT } from '../constants';
import Text from './Typography/Text';
import Portal from './Portal/Portal';
import { withTheme } from '../core/theming';
import { Theme } from '../types';

type Props = {
  /**
   * Tooltip title.
   */
  title: string;
  /**
   * Tooltip reference node.
   */
  children: React.ReactNode;
  /**
   * Delay in ms before onLongPress is called.
   */
  delayLongPress?: number;
  /**
   * Style that is passed to the children wrapper.
   */
  wrapperStyle?: StyleProp<ViewStyle>;
  /**
   * Style that is passed to the tooltip.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * @optional
   */
  theme: Theme;
};

type State = {
  childrenLayout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tooltipLayout: {
    width: number;
    height: number;
  };
  tooltipVisible: boolean;
  tooltipOpacity: number;
  tooltipMeasured: boolean;
};

/**
 * Tooltips display informative text when users tap an element.
 *
 * <div class="screenshots">
 *   <img class="medium" src="screenshots/tooltip.jpeg" />
 * </div>
 *
 * ## Usage
 * ```js
 * import * as React from 'react';
 * import { Tooltip, Appbar } from 'react-native-paper';
 *
 * const MyComponent = () => (
 *   <Tooltip title="Search">
 *     <Appbar.Action icon="search" onPress={() => {}} />
 *   </Tooltip>
 * );
 *
 * export default MyComponent;
 * ```
 */
class Tooltip extends React.Component<Props, State> {
  _longPressTimeout: number | undefined;
  _children: React.ReactNode;

  static defaultProps = { delayLongPress: 500 };

  state = {
    childrenLayout: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
    tooltipLayout: {
      width: 0,
      height: 0,
    },
    tooltipVisible: false,
    tooltipOpacity: 0,
    tooltipMeasured: false,
  };

  componentDidMount() {
    Dimensions.addEventListener('change', this._setChildrenPosition);

    this._setChildrenPosition();
  }

  componentWillUnmount() {
    Dimensions.removeEventListener('change', this._setChildrenPosition);

    this._clearTimeouts();
  }

  _setChildrenRef = (element: React.ReactNode) => {
    this._children = element;
  };

  _setChildrenPosition = () => {
    if (!this._children) return;

    // @ts-ignore
    const target = findNodeHandle(this._children);

    if (!target) return;

    setTimeout(() => {
      UIManager.measure(
        target,
        (
          _x: number,
          _y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number
        ) => {
          this.setState({
            childrenLayout: {
              x: pageX,
              y: pageY,
              width,
              height,
            },
          });
        }
      );
    }, 500);
  };

  _handleTooltipLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    const { tooltipMeasured } = this.state;

    if (!tooltipMeasured)
      this.setState({
        tooltipLayout: {
          width: layout.width,
          height: layout.height,
        },
        tooltipOpacity: 0.9,
        tooltipMeasured: true,
      });
  };

  _showTooltip() {
    this.setState({ tooltipVisible: true });
  }

  _hideTooltip() {
    this.setState({ tooltipVisible: false });
  }

  _clearTimeouts() {
    clearTimeout(this._longPressTimeout);
  }

  _handleTouchStart = () => {
    const { delayLongPress } = this.props;

    this._longPressTimeout = setTimeout(() => {
      this._showTooltip();
    }, delayLongPress);
  };

  _handleTouchEndCapture = () => {
    const { delayLongPress } = this.props;
    const { tooltipVisible } = this.state;

    this._clearTimeouts();
    this._longPressTimeout = setTimeout(() => {
      tooltipVisible && this._hideTooltip();
    }, delayLongPress);
  };

  _handleTouchCancel = () => {
    this._clearTimeouts();
    this._hideTooltip();
  };

  _overflowLeft(centerDistanceFromChildren: number) {
    return centerDistanceFromChildren < 0;
  }

  _overflowRight(centerDistanceFromChildren: number) {
    const {
      tooltipLayout: { width: tooltipWidth },
    } = this.state;

    const { width: layoutWidth } = Dimensions.get('window');

    return centerDistanceFromChildren + tooltipWidth > layoutWidth;
  }

  _overflowBottom() {
    const {
      childrenLayout: { y: childrenY, height: childrenHeight },
      tooltipLayout: { height: tooltipHeight },
    } = this.state;

    const { height: layoutHeight } = Dimensions.get('window');

    return (
      childrenY + childrenHeight + tooltipHeight + APPROX_STATUSBAR_HEIGHT >
      layoutHeight
    );
  }

  _getTooltipXPosition() {
    const {
      childrenLayout: { x: childrenX, width: childrenWidth },
      tooltipLayout: { width: tooltipWidth },
    } = this.state;

    const centerDistanceFromChildren =
      childrenX + (childrenWidth - tooltipWidth) / 2;

    if (this._overflowRight(centerDistanceFromChildren)) {
      return childrenX + childrenWidth - tooltipWidth;
    }
    // Does it overflow to the left? If so, starts from children start position
    else if (this._overflowLeft(centerDistanceFromChildren)) {
      return childrenX;
    }

    return centerDistanceFromChildren;
  }

  _getTooltipYPosition() {
    const {
      childrenLayout: { y: childrenY },
      tooltipLayout: { height: tooltipHeight },
    } = this.state;

    // If so, subtracts the tooltip height,
    // the marginTop applied to the tooltip and the status bar height.
    if (this._overflowBottom()) {
      return (
        childrenY -
        tooltipHeight -
        styles.tooltip.marginTop -
        APPROX_STATUSBAR_HEIGHT
      );
    }

    return childrenY + tooltipHeight;
  }

  render() {
    const { children, title, wrapperStyle, style, theme, ...rest } = this.props;
    const childElement = React.Children.only(children) as React.ReactElement;

    const { tooltipVisible, tooltipOpacity } = this.state;

    return (
      <View style={wrapperStyle}>
        <Portal>
          {tooltipVisible && (
            <View
              style={[
                styles.tooltip,
                {
                  opacity: tooltipOpacity,
                  left: this._getTooltipXPosition(),
                  top: this._getTooltipYPosition(),
                  borderRadius: theme.roundness,
                },
                style,
              ]}
              onLayout={this._handleTooltipLayout}
            >
              <Text style={{ color: Colors.white }}>{title}</Text>
            </View>
          )}
        </Portal>
        <View
          onTouchStart={this._handleTouchStart}
          onTouchEndCapture={this._handleTouchEndCapture}
          onTouchCancel={this._handleTouchCancel}
        >
          {React.cloneElement(childElement, {
            onLongPress: () => {}, // Prevent touchable to trigger onPress after onLongPress
            ...rest,
            ref: this._setChildrenRef,
          })}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  tooltip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.grey700,
    marginTop: 24,
    maxWidth: 300,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
});

export default withTheme(Tooltip);

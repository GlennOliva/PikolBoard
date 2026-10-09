import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its label", async () => {
    const { getByText } = await render(<Button label="Start match" onPress={() => {}} />);
    expect(getByText("Start match")).toBeTruthy();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Button label="Save" onPress={onPress} />);
    fireEvent.press(getByText("Save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner instead of the label while loading", async () => {
    const { queryByText } = await render(<Button label="Save" onPress={() => {}} loading />);
    expect(queryByText("Save")).toBeNull();
  });

  it("is disabled when the disabled prop is set", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Button label="Save" onPress={onPress} disabled />);
    fireEvent.press(getByText("Save"));
    expect(onPress).not.toHaveBeenCalled();
  });
});

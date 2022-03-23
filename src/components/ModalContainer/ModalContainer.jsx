import React from "react"
import { Button, Modal, ModalActions, ModalContent, ModalTitle, SingleSelect, SingleSelectOption, Field, Input, MultiSelect, MultiSelectOption } from '@dhis2/ui'
import ButtonItem from '../ButtonItem/ButtonItem'
import styles from './ModalContainer.module.css'

function ModalContainer(props) {
    const { title, action, setShowModal } = props

    const close = () => {
        setShowModal(false)
    }

    const renderForm = () => {
        return (
            <form>
                <Field label="Select the country">
                    <SingleSelect>
                        <SingleSelectOption value="1" label="Sierra Leone"/>
                        <SingleSelectOption value="2" label="Haiti"/>
                    </SingleSelect>
                </Field>

                <Field label="Name the catchment areas">
                    <Input/>
                </Field>
                <Field label="Select the facility level">
                    <SingleSelect>
                        <SingleSelectOption value="1" label="Sierra Leone"/>
                        <SingleSelectOption value="2" label="Haiti"/>
                    </SingleSelect>
                </Field>
                <Field label="Select the groups">
                    <MultiSelect>
                        <MultiSelectOption value="1" label="Sierra Leone"/>
                        <MultiSelectOption value="2" label="Haiti"/>
                    </MultiSelect>
                </Field>
            </form>
        )
    }
    return <Modal>
        <ModalTitle>{title}</ModalTitle>
        <ModalContent>
            {renderForm()}
        </ModalContent>
        <ModalActions><ButtonItem handleClick={close} buttonText={"Cancel"} secondary={true}/><ButtonItem buttonText={action} primary={true}/></ModalActions>
    </Modal>
}

export default ModalContainer